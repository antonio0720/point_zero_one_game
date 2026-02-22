import express from 'express';
import { getRepository } from 'typeorm';
import { CreateResourceDto } from '../dto/create-resource.dto';
import { Resource } from '../entities/resource.entity';
import { IResourceService } from '../interfaces/resource.service.interface';

class ResourceService implements IResourceService {
create(createResourceDto: CreateResourceDto): Promise<Resource> {
const resourceRepository = getRepository(Resource);
return resourceRepository.save(createResourceDto);
}
}

const router = express.Router();
const resourceService = new ResourceService();

router.post('/', async (req, res) => {
try {
const result = await resourceService.create(req.body);
res.status(201).json(result);
} catch (error) {
console.error(error);
res.status(500).json({ error: 'An error occurred while creating the resource.' });
}
});

export default router;
