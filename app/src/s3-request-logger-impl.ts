import { RequestLogger } from "./request-logger";
import { S3Client,PutObjectCommand,PutObjectCommandInput,PutObjectCommandOutput } from "@aws-sdk/client-s3";
import { RequestEnvelope } from 'ask-sdk-model';

export class S3RequestLogger implements RequestLogger {
    client: S3Client | undefined;
    region: string = "us-east-1";
    constructor(region: string) {
        this.region = region;
        this.client = new S3Client({region: region});
        return this;
    }
    logRequest(request: RequestEnvelope): void {
        if(this.client) {
            this.client.send(new PutObjectCommand({
                Bucket: `throwtrash-skill-request-logs-${this.region}`,
                Key: `request/${request.request.requestId}`,
                Body: JSON.stringify(request.request)
            })).then(_=>{}).catch(error=>{console.error(error)});
        }
    }
    logErrorRequest(request: RequestEnvelope): void {
        if(this.client) {
            this.client.send(new PutObjectCommand({
                Bucket: `throwtrash-skill-request-logs-${this.region}`,
                Key: `error/${request.request.requestId}`,
                Body: JSON.stringify(request.request)
            })).then(_=>{}).catch(error=>{console.error(error)});
        }
    }

}
