import { Readable } from "stream";
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import { RequestEnvelope } from "ask-sdk-model";

const s3Mock = mockClient(S3Client);
let S3PersistenceAdapter: typeof import("../s3-persistence-adapter.mjs").S3PersistenceAdapter;

const requestEnvelope: RequestEnvelope = {
    context: {
        System: {
            user: {
                userId: "user-123",
            },
        },
    },
} as RequestEnvelope;

beforeAll(async () => {
    ({ S3PersistenceAdapter } = await import("../s3-persistence-adapter.mjs"));
});

beforeEach(() => {
    s3Mock.reset();
});

describe("S3PersistenceAdapter.getAttributes", () => {
    it("NoSuchKeyの場合は空のオブジェクトを返す", async () => {
        const adapter = new S3PersistenceAdapter({ bucketName: "test-bucket" });

        s3Mock.on(GetObjectCommand).rejects({ name: "NoSuchKey" });

        await expect(adapter.getAttributes(requestEnvelope)).resolves.toEqual({});
    });

    it("保存済みデータを取得できる", async () => {
        const adapter = new S3PersistenceAdapter({ bucketName: "test-bucket" });
        const bodyStream = Readable.from([JSON.stringify({ foo: "bar" })]);

        s3Mock.on(GetObjectCommand).resolves({
            Body: bodyStream as any,
        });

        await expect(adapter.getAttributes(requestEnvelope)).resolves.toEqual({ foo: "bar" });
    });
});

describe("S3PersistenceAdapter.saveAttributes", () => {
    it("データを保存できる", async () => {
        const adapter = new S3PersistenceAdapter({ bucketName: "test-bucket" });

        s3Mock.on(PutObjectCommand).resolves({});

        await expect(adapter.saveAttributes(requestEnvelope, { a: 1 })).resolves.toBeUndefined();
        expect(s3Mock.commandCalls(PutObjectCommand).length).toBe(1);
    });
});

describe("S3PersistenceAdapter.deleteAttributes", () => {
    it("データを削除できる", async () => {
        const adapter = new S3PersistenceAdapter({ bucketName: "test-bucket" });

        s3Mock.on(DeleteObjectCommand).resolves({});

        await expect(adapter.deleteAttributes(requestEnvelope)).resolves.toBeUndefined();
        expect(s3Mock.commandCalls(DeleteObjectCommand).length).toBe(1);
    });
});
