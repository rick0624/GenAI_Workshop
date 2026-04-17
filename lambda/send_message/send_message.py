import json
import logging
import os
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

TABLE_NAME = os.environ["TABLE_NAME"]
DYNAMODB_ENDPOINT = os.environ.get("DYNAMODB_ENDPOINT")

dynamodb = boto3.resource(
    "dynamodb",
    **({"endpoint_url": DYNAMODB_ENDPOINT} if DYNAMODB_ENDPOINT else {}),
)
table = dynamodb.Table(TABLE_NAME)


def _scan_all_connections() -> list[dict]:
    """Return all connectionId items, handling DynamoDB pagination."""
    connections: list[dict] = []
    scan_kwargs: dict = {"ProjectionExpression": "connectionId"}
    while True:
        response = table.scan(**scan_kwargs)
        connections.extend(response["Items"])
        if "LastEvaluatedKey" not in response:
            break
        scan_kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]
    return connections


def handler(event: dict, _context) -> dict:
    try:
        # --- Parse body ---
        raw_body = event.get("body") or ""
        try:
            body = json.loads(raw_body)
        except (json.JSONDecodeError, TypeError):
            return {"statusCode": 400, "body": "Invalid JSON body"}

        text = body.get("text")
        if not text or not isinstance(text, str) or not text.strip():
            return {"statusCode": 400, "body": "Missing or invalid text"}
        if len(text) > 1000:
            return {"statusCode": 400, "body": "Missing or invalid text"}
        text = text.strip()

        # --- Get sender callsign ---
        ctx = event.get("requestContext", {})
        connection_id: str = ctx["connectionId"]
        domain_name: str = ctx.get("domainName", "")
        stage: str = ctx.get("stage", "")

        response = table.get_item(Key={"connectionId": connection_id})
        sender = response.get("Item")
        if not sender:
            logger.warning("Unknown sender: %s", connection_id)
            return {"statusCode": 400, "body": "Unknown sender"}

        callsign: str = sender["callsign"]

        # --- Build broadcast payload ---
        payload = json.dumps({
            "type": "message",
            "callsign": callsign,
            "text": text,
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        }).encode("utf-8")

        # --- Fan-out ---
        endpoint_url = f"https://{domain_name}/{stage}"
        apigw = boto3.client("apigatewaymanagementapi", endpoint_url=endpoint_url)

        connections = _scan_all_connections()
        logger.info("Broadcasting from %s (%s) to %d connections", connection_id, callsign, len(connections))

        for conn in connections:
            cid = conn["connectionId"]
            try:
                apigw.post_to_connection(ConnectionId=cid, Data=payload)
            except apigw.exceptions.GoneException:
                logger.info("Stale connection, removing: %s", cid)
                try:
                    table.delete_item(Key={"connectionId": cid})
                except ClientError:
                    pass
            except Exception as exc:
                logger.error("Failed to send to %s: %s", cid, exc)

        return {"statusCode": 200, "body": "Message sent"}

    except ClientError as exc:
        logger.error("DynamoDB error: %s", exc)
        return {"statusCode": 500, "body": "Internal server error"}
    except Exception as exc:
        logger.error("Unexpected error: %s", exc)
        return {"statusCode": 500, "body": "Internal server error"}
