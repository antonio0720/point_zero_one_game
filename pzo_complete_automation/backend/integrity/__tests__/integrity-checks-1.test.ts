import { IntegrityChecksService } from "../integrity/integrity-checks.service";
import { getRepository } from "typeorm";
import { IntegrityCheck } from "../../entity/IntegrityCheck";

jest.mock("typeorm", () => ({
getConnection: jest.fn(() => ({
getRepository: jest.fn(),
})),
}));

describe("IntegrityChecksService", () => {
let service: IntegrityChecksService;
const mockRepository = {
find: jest.fn(),
save: jest.fn(),
};

beforeEach(async () => {
getRepository.mockReturnValue({ find: jest.fn().mockResolvedValue([]), save: jest.fn() });
service = new IntegrityChecksService();
service.integrityCheckRepository = mockRepository;
});

it("should be defined", () => {
expect(service).toBeDefined();
});

describe("create", () => {
it("should create a new integrity check", async () => {
const integrityCheckData = new IntegrityCheck();
mockRepository.find.mockResolvedValue(null);
mockRepository.save.mockResolvedValue(integrityCheckData);

const result = await service.create(integrityCheckData);
expect(result).toEqual(integrityCheckData);
});
});

describe("findAll", () => {
it("should return all integrity checks", async () => {
mockRepository.find.mockResolvedValue([new IntegrityCheck(), new IntegrityCheck()]);

const result = await service.findAll();
expect(result).toEqual([expect.any(IntegrityCheck), expect.any(IntegrityCheck)]);
});
});
});
