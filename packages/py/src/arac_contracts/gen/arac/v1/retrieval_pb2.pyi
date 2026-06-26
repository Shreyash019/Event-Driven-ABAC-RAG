from google.protobuf.internal import containers as _containers
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Iterable as _Iterable, Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class SecurityContext(_message.Message):
    __slots__ = ("tenant_id", "subject_id", "scopes", "max_classification")
    TENANT_ID_FIELD_NUMBER: _ClassVar[int]
    SUBJECT_ID_FIELD_NUMBER: _ClassVar[int]
    SCOPES_FIELD_NUMBER: _ClassVar[int]
    MAX_CLASSIFICATION_FIELD_NUMBER: _ClassVar[int]
    tenant_id: str
    subject_id: str
    scopes: _containers.RepeatedScalarFieldContainer[str]
    max_classification: str
    def __init__(self, tenant_id: _Optional[str] = ..., subject_id: _Optional[str] = ..., scopes: _Optional[_Iterable[str]] = ..., max_classification: _Optional[str] = ...) -> None: ...

class SearchRequest(_message.Message):
    __slots__ = ("query", "top_k", "security")
    QUERY_FIELD_NUMBER: _ClassVar[int]
    TOP_K_FIELD_NUMBER: _ClassVar[int]
    SECURITY_FIELD_NUMBER: _ClassVar[int]
    query: str
    top_k: int
    security: SecurityContext
    def __init__(self, query: _Optional[str] = ..., top_k: _Optional[int] = ..., security: _Optional[_Union[SecurityContext, _Mapping]] = ...) -> None: ...

class RetrievedChunk(_message.Message):
    __slots__ = ("document_id", "chunk_id", "content", "score", "metadata")
    class MetadataEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: _Optional[str] = ..., value: _Optional[str] = ...) -> None: ...
    DOCUMENT_ID_FIELD_NUMBER: _ClassVar[int]
    CHUNK_ID_FIELD_NUMBER: _ClassVar[int]
    CONTENT_FIELD_NUMBER: _ClassVar[int]
    SCORE_FIELD_NUMBER: _ClassVar[int]
    METADATA_FIELD_NUMBER: _ClassVar[int]
    document_id: str
    chunk_id: str
    content: str
    score: float
    metadata: _containers.ScalarMap[str, str]
    def __init__(self, document_id: _Optional[str] = ..., chunk_id: _Optional[str] = ..., content: _Optional[str] = ..., score: _Optional[float] = ..., metadata: _Optional[_Mapping[str, str]] = ...) -> None: ...

class SearchResponse(_message.Message):
    __slots__ = ("chunks",)
    CHUNKS_FIELD_NUMBER: _ClassVar[int]
    chunks: _containers.RepeatedCompositeFieldContainer[RetrievedChunk]
    def __init__(self, chunks: _Optional[_Iterable[_Union[RetrievedChunk, _Mapping]]] = ...) -> None: ...
