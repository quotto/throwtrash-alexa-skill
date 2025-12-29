import crypto from "crypto";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";

process.env.APP_REGION = "us-west-2";

const ddbMock = mockClient(DynamoDBDocumentClient);
let DynamoDBAdapter: typeof import("../dynamodb-adapter.mjs").DynamoDBAdapter;

beforeAll(async () => {
    ({ DynamoDBAdapter } = await import("../dynamodb-adapter.mjs"));
});

beforeEach(() => {
    ddbMock.reset();
});

describe("DynamoDBAdapter.getUserIDByAccessToken", () => {
    it("有効期限内のアクセストークンはユーザーIDを返す", async () => {
        const adapter = new DynamoDBAdapter();
        const accessToken = "valid-token";
        const hashKey = crypto.createHash("sha512").update(accessToken).digest("hex");
        const now = Math.ceil(Date.now() / 1000);

        ddbMock.on(GetCommand, {
            TableName: "throwtrash-backend-accesstoken",
            Key: { access_token: hashKey },
        }).resolves({
            Item: {
                access_token: hashKey,
                user_id: "user-123",
                expires_in: now + 10,
            },
        });

        await expect(adapter.getUserIDByAccessToken(accessToken)).resolves.toBe("user-123");
    });

    it("期限切れのアクセストークンは空文字を返す", async () => {
        const adapter = new DynamoDBAdapter();
        const accessToken = "expired-token";
        const hashKey = crypto.createHash("sha512").update(accessToken).digest("hex");
        const now = Math.ceil(Date.now() / 1000);

        ddbMock.on(GetCommand).resolves({
            Item: {
                access_token: hashKey,
                user_id: "user-456",
                expires_in: now - 1,
            },
        });

        await expect(adapter.getUserIDByAccessToken(accessToken)).resolves.toBe("");
    });

    it("アクセストークンが存在しない場合は空文字を返す", async () => {
        const adapter = new DynamoDBAdapter();

        ddbMock.on(GetCommand).resolves({});

        await expect(adapter.getUserIDByAccessToken("missing-token")).resolves.toBe("");
    });

    it("DynamoDB取得失敗時は例外を投げる", async () => {
        const adapter = new DynamoDBAdapter();

        ddbMock.on(GetCommand).rejects(new Error("boom"));

        await expect(adapter.getUserIDByAccessToken("error-token")).rejects.toThrow(
            "Failed getUserIDByAccessToken"
        );
    });
});

describe("DynamoDBAdapter.getTrashSchedule", () => {
    it("スケジュールが存在する場合は内容を返す", async () => {
        const adapter = new DynamoDBAdapter();
        const schedule = [{ type: "burn", schedules: [{ type: "weekday", value: "1" }] }];

        ddbMock.on(GetCommand, {
            TableName: "TrashSchedule",
            Key: { id: "user-123" },
        }).resolves({
            Item: {
                description: JSON.stringify(schedule),
                nextdayflag: false,
            },
        });

        await expect(adapter.getTrashSchedule("user-123")).resolves.toEqual({
            trashData: schedule,
            checkedNextday: false,
        });
    });

    it("スケジュールが存在しない場合は空データを返す", async () => {
        const adapter = new DynamoDBAdapter();

        ddbMock.on(GetCommand).resolves({});

        await expect(adapter.getTrashSchedule("missing-user")).resolves.toEqual({
            trashData: [],
            checkedNextday: false,
        });
    });

    it("DynamoDB取得失敗時は例外を投げる", async () => {
        const adapter = new DynamoDBAdapter();

        ddbMock.on(GetCommand).rejects(new Error("boom"));

        await expect(adapter.getTrashSchedule("error-user")).rejects.toThrow("Failed GetTrashSchedule");
    });
});
