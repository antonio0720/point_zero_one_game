/**
 * CreatorProfiles service for Point Zero One Digital's financial roguelike game.
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProfileDto } from './dto/create-profile.dto';

/**
 * CreatorProfile entity representing a game creator's profile.
 */
export class CreatorProfile {
  id: number;
  username: string;
  passwordHash: string; // Hashed for security
  level: number;
  permissions: string[];
}

/**
 * CreatorProfiles service providing methods to manage creator profiles.
 */
@Injectable()
export class CreatorProfilesService {
  constructor(
    @InjectRepository(CreatorProfile)
    private readonly creatorProfileRepository: Repository<CreatorProfile>,
  ) {}

  /**
   * Creates a new creator profile with the provided data.
   * @param createProfileData Data for creating a new creator profile.
   */
  async create(createProfileData: CreateProfileDto): Promise<CreatorProfile> {
    const { username, passwordHash, level = 1, permissions = [] } = createProfileData;
    const creatorProfile = this.creatorProfileRepository.create({ username, passwordHash, level, permissions });
    return this.creatorProfileRepository.save(creatorProfile);
  }

  /**
   * Retrieves a creator profile by its ID.
   * @param id The ID of the creator profile to retrieve.
   */
  async findOne(id: number): Promise<CreatorProfile | null> {
    return this.creatorProfileRepository.findOneBy({ id });
  }
}
```

```sql
-- CreatorProfiles table schema for Point Zero One Digital's financial roguelike game.

CREATE TABLE IF NOT EXISTS creator_profiles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    level TINYINT UNSIGNED NOT NULL DEFAULT 1,
    permissions TEXT NOT NULL,
    INDEX (username),
    INDEX (level)
);
```

```bash
#!/bin/bash
set -euo pipefail

echo "Creating CreatorProfiles table..."
psql -f schema.sql

echo "Creating CreatorProfiles service..."
nest build
```

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: creator-profiles
secrets:
  - name: db-credentials

---

apiVersion: apps/v1
kind: Deployment
metadata:
  name: creator-profiles-deployment
spec:
  replicas: 1
  selector:
    matchLabels:
      app: creator-profiles
  template:
    metadata:
      labels:
        app: creator-profiles
    spec:
      containers:
        - name: creator-profiles
          image: pointzeroonedigital/creator-profiles:latest
          ports:
            - containerPort: 3000
          envFrom:
            - secretRef:
                name: db-credentials
      volumeClaimTemplates:
        - metadata:
            name: creator-profiles-data
          spec:
            accessModes: [ReadWriteOnce]
            resources:
              requests:
                storage: 10Mi
