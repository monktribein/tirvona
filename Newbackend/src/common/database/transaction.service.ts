import { Injectable } from "@nestjs/common";
import { InjectConnection } from "../../database/orm-nest";
import type { ClientSession, Connection } from "../../database/orm";

@Injectable()
export class TransactionService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async run<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = await this.connection.startSession();
    try {
      let result!: T;
      await session.withTransaction(async () => {
        result = await work(session);
      });
      return result;
    } finally {
      await session.endSession();
    }
  }
}
