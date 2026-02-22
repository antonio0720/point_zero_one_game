import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, GetQueryBuilder, UpdateQueryBuilder, DeleteQueryBuilder } from 'typeorm';
import { Metric } from './metric.entity';
import { MetricDto } from './dto/metric.dto';

@Injectable()
export class MetricsModelsService {
constructor(
@InjectRepository(Metric)
private readonly metricRepository: Repository<Metric>,
) {}

findAll(): Promise<Metric[]> {
return this.metricRepository.find();
}

findOneById(id: number): Promise<Metric | null> {
return this.metricRepository.findOneBy({ id });
}

create(metricData: MetricDto): Promise<Metric> {
const newMetric = this.metricRepository.create(metricData);
return this.metricRepository.save(newMetric);
}

update(id: number, metricData: Partial<MetricDto>): Promise<Metric | null> {
return this.metricRepository
.createQueryBuilder('metric')
.where('metric.id = :id', { id })
.set(metricData)
.execute()
.then((result) => result[0]);
}

deleteById(id: number): Promise<void> {
return this.metricRepository
.createQueryBuilder('metric')
.where('metric.id = :id', { id })
.delete()
.execute();
}

findMetricsByCriteria(criteria: any): Promise<Metric[]> {
const query = this.metricRepository.createQueryBuilder('metric');

if (criteria.startDate && criteria.endDate) {
query.andWhere('metric.date BETWEEN :startDate AND :endDate', { startDate: criteria.startDate, endDate: criteria.endDate });
}

if (criteria.metricName) {
query.andWhere('metric.name = :metricName', { metricName: criteria.metricName });
}

return query.getMany();
}
}
