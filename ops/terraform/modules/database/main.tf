Here is the Terraform configuration file `ops/terraform/modules/database/main.tf` for Point Zero One Digital's Postgres RDS/Cloud SQL setup, following the specified rules:

```hcl
provider "aws" {
  region = var.region
}

provider "google" {
  project = var.project_id
  region  = var.region
}

locals {
  aws_rds_subnet_group_name = "${var.environment}-rds-subnet-group"
  aws_rds_cluster_identifier = "${var.environment}-rds-cluster"
  aws_rds_cluster_instance_identifier = "${aws_rds_cluster.main.id}"

  gcp_sql_instance_name = "${var.environment}-sql-instance"
  gcp_sql_region = var.region
  gcp_sql_tier = "db-n1-standard-2"
  gcp_sql_backup_configuration = {
    enabled = true
    retention_days = 7
  }
}

module "aws_rds_subnet_group" {
  source = "./subnet_group"
  name   = local.aws_rds_subnet_group_name
  vpc_id = var.vpc_id
  subnets = var.subnets
}

module "aws_rds_cluster" {
  source = "./rds-cluster"
  name   = local.aws_rds_cluster_identifier
  engine = "postgres"
  master_username = var.master_username
  master_password = var.master_password
  subnet_group_name = local.aws_rds_subnet_group_name
  vpc_security_group_ids = var.vpc_security_group_ids
  skip_final_snapshot = true
  backup_window = "03:00-06:00"
  maintenance_window = "mon:00:00-mon:03:00"
}

module "aws_rds_read_replica" {
  source = "./rds-read-replica"
  name   = "${local.aws_rds_cluster_identifier}-read-replica"
  cluster_identifier = local.aws_rds_cluster_instance_identifier
}

resource "aws_db_subnet_group" "main" {}

output "connection_string" {
  value = "${module.aws_rds_cluster.connection_string}"
}

provider "google" {
  alias = "gcp"
}

module "pgbouncer" {
  source = "./pgbouncer"
  project_id = var.project_id
  region = local.gcp_sql_region
  instance_name = "${local.gcp_sql_instance_name}-pgbouncer"
  instance_type = "n1-standard-2"
  subnetwork = var.subnet
}

provider "google" {
  alias = "gcp_read_replica"
}

module "gcp_sql_instance_read_replica" {
  source = "./sql-instance-read-replica"
  project_id = var.project_id
  region = local.gcp_sql_region
  instance_name = "${local.gcp_sql_instance_name}-read-replica"
  tier = "db-n1-standard-2"
  backup_configuration = local.gcp_sql_backup_configuration
}

provider "google" {
  alias = "gcp_pgbouncer"
}

resource "google_sql_user" "main" {
  provider = google.gcp_pgbouncer
  instance = module.pgbouncer.instance_id
  name     = var.master_username
  password = var.master_password
}

output "connection_string_gcp" {
  value = "${module.pgbouncer.connection_string}"
}
