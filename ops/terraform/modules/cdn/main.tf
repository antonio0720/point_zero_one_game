Here is the Terraform configuration for the specified requirements in YAML format:

```yaml
terraform {
  required_version = ">= 0.14"
}

provider "aws" {
  region = "us-west-2"
}

data "aws_caller_identity" "current" {}

module "cloudfront_distribution" {
  source = "./modules/cloudfront"

  origin = {
    s3 = {
      domain_name = "${aws_s3_bucket.explorer_pages.bucket_regional_domain_name}"
      origin_id   = "explorer-pages"
    }

    custom_origin = {
      domain_name = "${aws_s3_bucket.og_images.bucket_regional_domain_name}"
      origin_path = "/og-images/*"
      origin_id   = "og-images"
    }
  }

  default_cache_behavior = {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "explorer-pages"

    forwarded_values = {
      cookies = {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 300
    default_ttl            = 3600
    max_ttl                = 86400
  }

  restrictions = {
    geo_restriction = {
      restriction_type = "whitelist"
      locations        = ["US", "CA"]
    }
  }

  price_class = "PriceClass_All"
  aliases     = ["${data.aws_caller_identity.current.account_id}.d11cdn.com"]
}

module "signed_cloudfront_distribution" {
  source = "./modules/cloudfront"

  origin = {
    s3 = {
      domain_name = "${aws_s3_bucket.private_content.bucket_regional_domain_name}"
      origin_id   = "private-content"
    }
  }

  default_cache_behavior = {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "private-content"

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 300
    default_ttl            = 3600
    max_ttl                = 86400
  }

  custom_error_response = {
    error_code = "403"
    response_page_path = "/403.html"
    response_headers_policy = {
      redirect = {
        status_code = "HTTP_301",
        response_header = "Location"
        headers = {
          "Access-Control-Allow-Origin" = "*"
        }
      }
    }
  }

  restrictions = {
    none = {}
  }

  viewer_certificate = {
    cloudfront_default_certificate = true
  }
}
