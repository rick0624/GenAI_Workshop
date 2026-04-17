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


def _broadcast_system_event(domain_name: str, stage: str, callsign: str) -> None:
    """Push a user_left system event to all remaining connections."""
    endpoint_url = f"https://{domain_name}/{stage}"
    apigw = boto3.client("apigatewaymanagementapi", endpoint_url=endpoint_url)

    payload = json.dumps({
        "type": "system",
        "event": "user_left",
        "callsign": callsign,
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }).encode("utf-8")

    connections = []
    scan_kwargs: dict = {"ProjectionExpression": "connectionId"}
    while True:
        response = table.scan(**scan_kwargs)
        connections.extend(response["Items"])
        if "LastEvaluatedKey" not in response:
            break
        scan_kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]

    for conn in connections:
        cid = conn["connectionId"]
        try:
            apigw.post_to_connection(ConnectionId=cid, Data=payload)
        except apigw.exceptions.GoneException:
            try:
                table.delete_item(Key={"connectionId": cid})
            except ClientError:
                pass
        except Exception as exc:
            logger.warning("Failed to notify %s: %s", cid, exc)


def handler(event: dict, _context) -> dict:
    try:
        ctx = event.get("requestContext", {})
        connection_id: str = ctx["connectionId"]
        domain_name: str = ctx.get("domainName", "")
        stage: str = ctx.get("stage", "")

        # Get callsign before deleting — needed for the broadcast
        callsign = "unknown"
        try:
            response = table.get_item(Key={"connectionId": connection_id})
            callsign = response.get("Item", {}).get("callsign", "unknown")
        except ClientError as exc:
            logger.warning("Could not retrieve callsign for %s: %s", connection_id, exc)

        table.delete_item(Key={"connectionId": connection_id})
        logger.info("Disconnected: %s (%s)", connection_id, callsign)

        # Best-effort: broadcast leave event to remaining connections
        if domain_name and domain_name != "localhost":
            try:
                _broadcast_system_event(domain_name, stage, callsign)
            except Exception as exc:
                logger.warning("Broadcast user_left failed: %s", exc)

        return {"statusCode": 200, "body": "Disconnected"}

    except ClientError as exc:
        logger.error("DynamoDB error: %s", exc)
        return {"statusCode": 500, "body": "Internal server error"}
    except Exception as exc:
        logger.error("Unexpected error: %s", exc)
        return {"statusCode": 500, "body": "Internal server error"}
