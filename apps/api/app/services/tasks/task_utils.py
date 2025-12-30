"""
Task Utilities for Celery

Provides utilities for scalable task processing:
- Chunking large datasets into smaller tasks
- Distributed processing across workers
- Progress tracking and aggregation

SCALABILITY NOTES:
- CHUNK_SIZE determines memory usage per worker
- Smaller chunks = better distribution but more overhead
- Larger chunks = less overhead but risk of timeouts
"""

from typing import List, Any, Callable, Dict, TypeVar

T = TypeVar("T")
from app.core.celery_app import celery_app
from app.services.logger import logger

# Default chunk size for user processing
# 100 users per chunk balances memory vs overhead
DEFAULT_CHUNK_SIZE = 100


def chunk_list(
    items: List[Any], chunk_size: int = DEFAULT_CHUNK_SIZE
) -> List[List[Any]]:
    """
    Split a list into chunks of specified size.

    Args:
        items: List to split
        chunk_size: Size of each chunk

    Returns:
        List of chunks
    """
    return [items[i : i + chunk_size] for i in range(0, len(items), chunk_size)]


def create_chunked_task_signature(
    task_name: str,
    user_ids: List[str],
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    **kwargs,
) -> List:
    """
    Create Celery task signatures for chunked processing.

    Usage:
        signatures = create_chunked_task_signature(
            "send_notifications_chunk",
            user_ids,
            chunk_size=100,
            date="2024-01-01"
        )
        from celery import group
        group(signatures).apply_async()

    Args:
        task_name: Name of the Celery task to call for each chunk
        user_ids: List of user IDs to process
        chunk_size: Number of users per chunk
        **kwargs: Additional arguments to pass to each task

    Returns:
        List of task signatures
    """
    chunks = chunk_list(user_ids, chunk_size)
    task = celery_app.signature(task_name)

    return [task.clone(args=(chunk,), kwargs=kwargs) for chunk in chunks]


@celery_app.task(
    name="aggregate_chunk_results",
    bind=True,
    max_retries=1,
)
def aggregate_chunk_results_task(self, results: List[Dict], task_name: str) -> Dict:
    """
    Aggregate results from chunked tasks.

    Args:
        results: List of result dicts from chunk tasks
        task_name: Name of the parent task (for logging)

    Returns:
        Aggregated stats
    """
    aggregated = {
        "status": "success",
        "total_chunks": len(results),
        "total_processed": 0,
        "total_success": 0,
        "total_failed": 0,
    }

    for result in results:
        if isinstance(result, dict):
            aggregated["total_processed"] += result.get("processed", 0)
            aggregated["total_success"] += result.get("success", result.get("sent", 0))
            aggregated["total_failed"] += result.get("failed", result.get("skipped", 0))

    logger.info(
        f"Aggregated {task_name} results",
        aggregated,
    )

    return aggregated


def dispatch_chunked_tasks(
    task: Any,
    items: List[Any],
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    **kwargs,
) -> Dict[str, Any]:
    """
    Dispatch a Celery task for each chunk of items.

    This is the recommended way to process large lists:
    1. Split items into chunks
    2. Dispatch a task for each chunk
    3. Each task processes independently (fire-and-forget)

    Usage:
        from app.services.tasks.task_utils import dispatch_chunked_tasks
        from app.services.tasks.subscription_tasks import notify_chunk_task

        result = dispatch_chunked_tasks(
            task=notify_chunk_task,
            items=user_ids,
            chunk_size=50,
            # Additional kwargs passed to each task:
            challenge_id=challenge_id,
            reason="cancelled",
        )
        # Returns: {"dispatched": 5, "total_items": 247}

    Args:
        task: Celery task to call (e.g., my_task or my_task.delay)
        items: List of items to process
        chunk_size: Number of items per chunk (default: 100)
        **kwargs: Additional arguments passed to each task call

    Returns:
        Dict with dispatch stats
    """
    if not items:
        return {"dispatched": 0, "total_items": 0}

    chunks = chunk_list(items, chunk_size)

    for chunk in chunks:
        task.delay(chunk, **kwargs)

    logger.info(
        f"Dispatched {len(chunks)} chunk tasks for {len(items)} items",
        {
            "chunk_size": chunk_size,
            "task": str(task.name) if hasattr(task, "name") else str(task),
        },
    )

    return {
        "dispatched": len(chunks),
        "total_items": len(items),
        "chunk_size": chunk_size,
    }


def process_in_batches(
    items: List[Any],
    processor: Callable[[List[Any]], Dict],
    batch_size: int = DEFAULT_CHUNK_SIZE,
) -> Dict[str, Any]:
    """
    Process items in batches using a provided processor function.

    For synchronous batch processing within a single task.
    Use this when you want to process in batches but don't need
    separate Celery tasks for each batch.

    Usage:
        def send_notifications(user_ids: List[str]) -> Dict:
            sent = 0
            for uid in user_ids:
                if send_push(uid):
                    sent += 1
            return {"sent": sent}

        result = process_in_batches(
            items=all_user_ids,
            processor=send_notifications,
            batch_size=100,
        )

    Args:
        items: List of items to process
        processor: Function that takes a list and returns a dict with results
        batch_size: Size of each batch

    Returns:
        Aggregated results from all batches
    """
    if not items:
        return {"processed": 0, "batches": 0}

    chunks = chunk_list(items, batch_size)
    total_results = {
        "processed": 0,
        "batches": len(chunks),
    }

    for i, chunk in enumerate(chunks):
        try:
            result = processor(chunk)
            if isinstance(result, dict):
                for key, value in result.items():
                    if isinstance(value, (int, float)):
                        total_results[key] = total_results.get(key, 0) + value
            total_results["processed"] += len(chunk)
        except Exception as e:
            logger.error(f"Batch {i+1}/{len(chunks)} failed: {e}")
            total_results["errors"] = total_results.get("errors", 0) + 1

    return total_results
