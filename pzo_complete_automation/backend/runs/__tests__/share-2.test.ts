import { Test, TestingModule } from '@nestjs/testing';
import { ShareService } from '../share.service';
import { CreateShareDto } from '../../dto/create-share.dto';
import { GetSharesFilterDto } from '../../dto/get-shares-filter.dto';
import { SharedFile } from '../../interfaces/shared-file.interface';
import { FilesService } from 'src/files/files.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Share } from '../entities/share.entity';
import { User } from 'src/auth/user.entity';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

describe('ShareService (e2e)', () => {
let service: ShareService;
let filesService: FilesService;

beforeEach(async () => {
const module: TestingModule = await Test.createTestingModule({
providers: [ShareService, FilesService],
guards: [JwtAuthGuard],
})
.overrideProvider(getRepositoryToken(Share))
.useValue(() => ({
create: jest.fn(),
findAll: jest.fn(),
findOneBy: jest.fn(),
delete: jest.fn(),
}))
.overrideProvider(getRepositoryToken(User))
.useValue(() => ({
findOneBy: jest.fn(),
}))
.compile();

service = module.get<ShareService>(ShareService);
filesService = module.get<FilesService>(FilesService);
});

const createShareDto: CreateShareDto = {
recipientId: '1',
sharedFile: new SharedFile('test-file.txt', 'test-content'),
};

const getSharesFilterDto: GetSharesFilterDto = {
userId: '1',
};

it('should create a share', async () => {
// Implement the tests for creating a share here
});

it('should return all shares of user', async () => {
// Implement the tests for getting all shares of a user here
});

it('should find a share', async () => {
// Implement the tests for finding a specific share here
});

it('should delete a share', async () => {
// Implement the tests for deleting a share here
});
});
