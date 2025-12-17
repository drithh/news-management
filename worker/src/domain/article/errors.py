class ArticleNotFoundError(Exception):
    """Raised when an article doesn't exist."""


class InvalidJobMessageError(Exception):
    """Raised when a job message has an invalid format or data."""


class MessageRequeueError(Exception):
    """Raised when a message should be requeued immediately without retry counting.
    
    This is used for transient conditions like IN_PROGRESS status where
    the message should be retried immediately, not counted as a failure.
    """


