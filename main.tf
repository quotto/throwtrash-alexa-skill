terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 3.66"
    }
  }

  backend "s3" {
    key    = "throwtrash-skill.tfstate"
  }
}

provider "aws" {
  region = "${var.region}"
}

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}


data "archive_file" "app_zip" {
  type        = "zip"
  source_dir  = "${path.root}/app/dist"
  output_path = "${path.root}/app/app.zip"
  excludes = ["src","node_modules"]
}

data "archive_file" "libs_zip" {
  type        = "zip"
  source_dir  = "${path.root}/app/libs"
  output_path = "${path.root}/app/libs.zip"
}

variable "AppID" {
  type        = string
  description = "The application ID"
}

variable "RunLevel" {
  type        = string
  default     = "DEBUG"
  description = "The run level of the application"
}

variable "ApiUrl" {
  type        = string
  description = "The API URL"
}

variable "ApiKey" {
  type        = string
  description = "The API key"
}

variable "ReminderProductID" {
  type        = string
  description = "The reminder product ID"
}

variable "region" {
  type        = string
  default     = "us-west-2"
  description = "The region"
}

resource "aws_iam_policy" "LambdaExecPolicy" {
  name   = "throwtrash-lambda-policy-${var.region}"
  tags = {
    app   = "throwtrash"
    group = "skill"
  }
  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "dynamodb:*",
      "Resource": [
        "arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/throwtrash-db-schedule",
        "arn:aws:dynamodb:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/throwtrash-db-accesstoken"
      ]
    },
    {
      "Effect": "Allow",
      "Action": "lambda:*",
      "Resource": "${aws_lambda_function.ThrowTrashSkill.arn}"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": [
        "${aws_s3_bucket.PreferenceBucket.arn}",
        "${aws_s3_bucket.PreferenceBucket.arn}/*",
        "${aws_s3_bucket.RequestLogBucket.arn}",
        "${aws_s3_bucket.RequestLogBucket.arn}/*"
      ]
    }
  ]
}
EOF
}

resource "aws_iam_role" "LambdaExecRole" {
  name               = "throwtrash-lambda-role-${var.region}"
  tags = {
    app   = "throwtrash"
    group = "skill"
  }
  managed_policy_arns = [
    "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
  ]
  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
}

resource "aws_iam_role_policy_attachment" "LambdaRolePolicyAttachment" {
  role       = aws_iam_role.LambdaExecRole.name
  policy_arn = aws_iam_policy.LambdaExecPolicy.arn
}

resource "aws_s3_bucket" "PreferenceBucket" {
  bucket = "throwtrash-skill-preference-${var.region}"
  tags = {
    app   = "throwtrash"
    group = "skill"
  }
}

resource "aws_s3_bucket_acl" "PreferenceBucketAcl" {
  bucket = aws_s3_bucket.PreferenceBucket.id
  acl    = "private"
}

resource "aws_s3_bucket" "RequestLogBucket" {
  bucket = "throwtrash-skill-request-logs-${var.region}"

  tags = {
    app   = "throwtrash"
    group = "skill"
  }
}

resource "aws_s3_bucket_acl" "RequestLogBucketAcl" {
  bucket = aws_s3_bucket.RequestLogBucket.id
  acl    = "private"
}

resource "aws_lambda_function" "ThrowTrashSkill" {
  function_name = "arn:aws:lambda:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:function:ThrowTrashSkill"
  role          = aws_iam_role.LambdaExecRole.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  source_code_hash = "${data.archive_file.app_zip.output_base64sha256}"
  filename = data.archive_file.app_zip.output_path

  environment {
    variables = {
      APP_REGION           = var.region
      APP_ID               = var.AppID
      RUNLEVEL             = var.RunLevel
      MECAB_API_URL        = var.ApiUrl
      MECAB_API_KEY        = var.ApiKey
      REMINDER_PRODUCT_ID  = var.ReminderProductID
    }
  }
  timeout = 30

  layers = [
    aws_lambda_layer_version.Layer.arn
  ]

  tags = {
    group   = "skill"
    app = "throwtrash"
  }
}

resource "aws_lambda_layer_version" "Layer" {
  layer_name    = "throwtrash-skill-libs"
  description   = "throwtrash-skill library"
  skip_destroy = true
  compatible_runtimes = ["nodejs18.x"]
  filename = data.archive_file.libs_zip.output_path
  source_code_hash = "${data.archive_file.libs_zip.output_base64sha256}"
}

resource "aws_lambda_permission" "LambdaEvent" {
  statement_id  = "AllowExecutionFromAlexa"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ThrowTrashSkill.function_name
  principal     = "alexa-appkit.amazon.com"
  event_source_token = var.AppID
}