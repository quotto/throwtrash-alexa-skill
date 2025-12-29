import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { createAskSdkError, PersistenceAdapter } from "ask-sdk-core";
import { RequestEnvelope } from "ask-sdk-model";
import path from "path";
import { Readable } from "stream";

type ObjectKeyGenerator = (requestEnvelope: RequestEnvelope) => string;

type S3PersistenceAdapterConfig = {
    bucketName: string;
    s3Client?: S3Client;
    objectKeyGenerator?: ObjectKeyGenerator;
    pathPrefix?: string;
};

const ObjectKeyGenerators = {
    userId(requestEnvelope: RequestEnvelope) {
        if (!(
            requestEnvelope
            && requestEnvelope.context
            && requestEnvelope.context.System
            && requestEnvelope.context.System.user
            && requestEnvelope.context.System.user.userId
        )) {
            throw createAskSdkError("PartitionKeyGenerators", "Cannot retrieve user id from request envelope!");
        }
        return requestEnvelope.context.System.user.userId;
    },
    deviceId(requestEnvelope: RequestEnvelope) {
        if (!(
            requestEnvelope
            && requestEnvelope.context
            && requestEnvelope.context.System
            && requestEnvelope.context.System.device
            && requestEnvelope.context.System.device.deviceId
        )) {
            throw createAskSdkError("PartitionKeyGenerators", "Cannot retrieve device id from request envelope!");
        }
        return requestEnvelope.context.System.device.deviceId;
    }
};

const streamToString = async (body: unknown): Promise<string> => {
    if (!body) {
        return "";
    }
    if (typeof body === "string") {
        return body;
    }
    if (body instanceof Uint8Array) {
        return Buffer.from(body).toString("utf-8");
    }
    const streamBody = body as { transformToString?: () => Promise<string> };
    if (typeof streamBody.transformToString === "function") {
        return streamBody.transformToString();
    }
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        (body as Readable)
            .on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
            .once("error", reject)
            .once("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    });
};

export class S3PersistenceAdapter implements PersistenceAdapter {
    private bucketName: string;
    private s3Client: S3Client;
    private objectKeyGenerator: ObjectKeyGenerator;
    private pathPrefix: string;

    constructor(config: S3PersistenceAdapterConfig) {
        this.bucketName = config.bucketName;
        this.s3Client = config.s3Client ?? new S3Client({});
        this.objectKeyGenerator = config.objectKeyGenerator ?? ObjectKeyGenerators.userId;
        this.pathPrefix = config.pathPrefix ?? "";
    }

    async getAttributes(requestEnvelope: RequestEnvelope): Promise<Record<string, unknown>> {
        const objectId = path.join(this.pathPrefix, this.objectKeyGenerator(requestEnvelope));
        const getParams = {
            Bucket: this.bucketName,
            Key: objectId,
        };
        let data;
        try {
            data = await this.s3Client.send(new GetObjectCommand(getParams));
        } catch (err: any) {
            if (err?.name === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404) {
                return {};
            }
            throw createAskSdkError(
                this.constructor.name,
                `Could not read item (${objectId}) from bucket (${getParams.Bucket}): ${err.message}`
            );
        }
        const bodyString = await streamToString(data.Body);
        if (!bodyString) {
            return {};
        }
        try {
            return JSON.parse(bodyString) as Record<string, unknown>;
        } catch {
            throw new SyntaxError(`Failed trying to parse the data body: ${bodyString}`);
        }
    }

    async saveAttributes(requestEnvelope: RequestEnvelope, attributes: Record<string, unknown>): Promise<void> {
        const objectId = path.join(this.pathPrefix, this.objectKeyGenerator(requestEnvelope));
        const putParams = {
            Bucket: this.bucketName,
            Key: objectId,
            Body: JSON.stringify(attributes),
        };
        try {
            await this.s3Client.send(new PutObjectCommand(putParams));
        } catch (err: any) {
            throw createAskSdkError(
                this.constructor.name,
                `Could not save item (${objectId}) to bucket (${putParams.Bucket}): ${err.message}`
            );
        }
    }

    async deleteAttributes(requestEnvelope: RequestEnvelope): Promise<void> {
        const objectId = path.join(this.pathPrefix, this.objectKeyGenerator(requestEnvelope));
        const deleteParams = {
            Bucket: this.bucketName,
            Key: objectId,
        };
        try {
            await this.s3Client.send(new DeleteObjectCommand(deleteParams));
        } catch (err: any) {
            throw createAskSdkError(
                this.constructor.name,
                `Could not delete item (${objectId}) from bucket (${deleteParams.Bucket}): ${err.message}`
            );
        }
    }
}

export { ObjectKeyGenerators, ObjectKeyGenerator };
