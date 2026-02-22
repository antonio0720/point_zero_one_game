import { Test, TestingModule } from '@nestjs/testing';
import { DataWarehouseService } from './data-warehouse.service';
import { DataWarehouseController } from './data-warehouse.controller';
import { DataWarehouseRepository } from './data-warehouse.repository';
import { UserRepository } from '../user/user.repository';
import { TransactionRepository } from '../transaction/transaction.repository';
import { getConnection, Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { Transaction } from '../transaction/entities/transaction.entity';

describe('DataWarehouse (e2e)', () => {
let dataWarehouseService: DataWarehouseService;
let dataWarehouseController: DataWarehouseController;
let dataWarehouseRepository: DataWarehouseRepository;
let userRepository: UserRepository;
let transactionRepository: TransactionRepository;
let connection: any;

beforeAll(async () => {
const module: TestingModule = await Test.createTestingModule({
controllers: [DataWarehouseController],
providers: [
DataWarehouseService,
DataWarehouseRepository,
UserRepository,
TransactionRepository,
{
provide: getConnection,
useValue: inMemoryDataSource.createConnection(),
},
],
}).compile();

dataWarehouseService = module.get<DataWarehouseService>(DataWarehouseService);
dataWarehouseController = module.get<DataWarehouseController>(DataWarehouseController);
dataWarehouseRepository = module.get<DataWarehouseRepository>(DataWarehouseRepository);
userRepository = module.get<UserRepository>(UserRepository);
transactionRepository = module.get<TransactionRepository>(TransactionRepository);
connection = module.get(getConnection);

await connection.sync();
});

afterEach(async () => {
// Perform any necessary cleanup or reset operations here
});

describe('getDataWarehouse', () => {
it('should return the correct data warehouse data', async () => {
const user = new User();
user.id = 1;
user.username = 'test_user';
await userRepository.save(user);

const transaction = new Transaction();
transaction.userId = user.id;
transaction.amount = 100;
await transactionRepository.save(transaction);

const result = await dataWarehouseService.getDataWarehouse();

// Add assertions here for the expected structure and content of the result object
});
});
});
