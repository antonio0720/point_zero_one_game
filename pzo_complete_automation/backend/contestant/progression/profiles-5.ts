import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateContestantProfileDto } from './dto/create-contestant-profile.dto';
import { UpdateContestantProfileDto } from './dto/update-contestant-profile.dto';
import { ContestantProfile } from './entities/contestant-profile.entity';

@Injectable()
export class ProfilesService {
constructor(
@InjectRepository(ContestantProfile)
private contestantProfileRepository: Repository<ContestantProfile>,
) {}

create(createContestantProfileDto: CreateContestantProfileDto) {
return this.contestantProfileRepository.save(createContestantProfileDto);
}

findAll() {
return this.contestantProfileRepository.find();
}

findOne(id: number) {
return this.contestantProfileRepository.findOneBy({ id });
}

update(id: number, updateContestantProfileDto: UpdateContestantProfileDto) {
return this.contestantProfileRepository.update(id, updateContestantProfileDto);
}

remove(id: number) {
return this.contestantProfileRepository.delete({ id });
}
}
