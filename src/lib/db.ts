import {
  Column,
  Default,
  Model,
  Sequelize,
  Table
} from "sequelize-typescript";
import * as config from "config";
import { genSaltSync, hashSync } from "bcrypt";


export const sequelize = new Sequelize({
  logging: false,
  ...config.get("db"),
});

@Table({
  timestamps: false,
})
export class Client extends Model<Client> {
  @Column
  bucket: string;

  @Default(genSaltSync)
  @Column
  salt: string;

  public getKey(): string {
    return hashSync(this.bucket, this.salt);
  }
}

@Table({
  timestamps: false,
})
export class Usage extends Model<Usage> {
  @Column
  client: string;

  @Column
  createdAt: Date;

  @Column
  size: number;
}


export const setupDatabase = () => {
  sequelize.addModels([Client, Usage]);
  Client.sync();
  Usage.sync();

};
