import { z } from "zod/v4";
export declare const revokedSessionsTable: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "revoked_sessions";
    schema: undefined;
    columns: {
        tokenHash: import("drizzle-orm/pg-core").PgColumn<{
            name: "token_hash";
            tableName: "revoked_sessions";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: true;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        expiresAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "expires_at";
            tableName: "revoked_sessions";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
export declare const insertRevokedSessionSchema: import("drizzle-zod").BuildSchema<"insert", {
    tokenHash: import("drizzle-orm/pg-core").PgColumn<{
        name: "token_hash";
        tableName: "revoked_sessions";
        dataType: "string";
        columnType: "PgText";
        data: string;
        driverParam: string;
        notNull: true;
        hasDefault: false;
        isPrimaryKey: true;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: [string, ...string[]];
        baseColumn: never;
        identity: undefined;
        generated: undefined;
    }, {}, {}>;
    expiresAt: import("drizzle-orm/pg-core").PgColumn<{
        name: "expires_at";
        tableName: "revoked_sessions";
        dataType: "date";
        columnType: "PgTimestamp";
        data: Date;
        driverParam: string;
        notNull: true;
        hasDefault: false;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: undefined;
        baseColumn: never;
        identity: undefined;
        generated: undefined;
    }, {}, {}>;
}, undefined, undefined>;
export type RevokedSession = typeof revokedSessionsTable.$inferSelect;
export type InsertRevokedSession = z.infer<typeof insertRevokedSessionSchema>;
//# sourceMappingURL=sessions.d.ts.map