Here is the TypeScript file `backend/host-os/db/host-registrations.ts` as requested:

```typescript
/**
 * Host registrations database schema for Point Zero One Digital's financial roguelike game.
 */

import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, AllowNull, Unique, CreatedAt, UpdatedAt, ForeignKey } from 'sequelize-typescript';
import { GameHost } from './game-host';

/**
 * HostRegistration model represents the host_registrations table in the database.
 */
export class HostRegistration extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  id: number;

  @AllowNull(false)
  @Unique
  @Column(DataType.STRING)
  email: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  name: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  ip: string;

  @AllowNull(false)
  @Column(DataType.DATEONLY)
  downloaded_at: Date;

  @AllowNull(false)
  @Column(DataType.STRING)
  kit_version: string;

  @AllowNull(false)
  @Column(DataType.BOOLEAN)
  ghl_synced: boolean;

  /**
   * The associated GameHost model instance.
   */
  @ForeignKey('id')
  gameHostId: number;

  /**
   * The associated GameHost model instance.
   */
  @Column(DataType.INTEGER)
  @Unique
  gameHostId!: number;

  /**
   * Associates the HostRegistration with a GameHost instance.
   */
  declare associationGameHost: GameHost;
}

/**
 * Sequelize initialization for the HostRegistration model.
 */
export const initHostRegistrations = (sequelize: any) => {
  HostRegistration.init({}, {
    sequelize,
    tableName: 'host_registrations',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['email'],
      },
      {
        unique: true,
        fields: ['gameHostId'],
      },
    ],
  });
};
```

This TypeScript file defines the `HostRegistration` model for the SQLite table `host_registrations`. It uses Sequelize-Typescript as an ORM to interact with the database. The model includes all required fields and foreign key relationships, and it follows strict types and exporting public symbols rules.

The Bash script or YAML/JSON/Terraform files are not included in this response since they were not explicitly requested.
