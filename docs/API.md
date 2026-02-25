# FileFlow API Reference

**Base URL:** `http://localhost:8680` (development) | `https://fileflow.silverflow.ca` (production)

## Authentication

### User Authentication
Most endpoints require a Bearer token from Supabase authentication:
```
Authorization: Bearer <supabase_jwt_token>
```

### API Key Authentication
For external integrations, use the `/api/v1/*` endpoints with an API key:
```
Authorization: Bearer ff_<your_api_key>
```

---

## Quick Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| **Auth** |||
| POST | `/api/auth/login` | Login with email/password |
| POST | `/api/auth/register` | Create new account |
| GET | `/api/auth/me` | Get current user |
| **Files** |||
| GET | `/api/files` | List files |
| POST | `/api/files` | Create file record |
| DELETE | `/api/files/:id` | Delete file |
| GET | `/api/files/:id/details` | Get detailed file info |
| POST | `/api/files/upload-url` | Get signed upload URL |
| POST | `/api/files/merge-pdf` | Merge multiple PDFs |
| GET | `/api/storage/download/:id` | Download file |
| **Folders** |||
| GET | `/api/folders` | List folders |
| POST | `/api/folders` | Create folder |
| DELETE | `/api/folders/:id` | Delete folder |
| **Sharing** |||
| GET | `/api/files/:id/links` | Get share links |
| POST | `/api/files/:id/links` | Create share link |
| DELETE | `/api/files/:id/links/:linkId` | Delete share link |
| GET | `/api/share/:token` | Access shared file (public) |
| GET | `/api/files/:id/permissions` | Get permissions |
| POST | `/api/files/:id/permissions` | Add permission |
| **E-Signature** |||
| GET | `/api/esignature/requests` | List signature requests |
| POST | `/api/esignature/requests` | Create signature request |
| GET | `/api/esignature/requests/:id` | Get request details |
| POST | `/api/esignature/requests/:id/send` | Send for signing |
| POST | `/api/esignature/requests/:id/cancel` | Cancel request |
| GET | `/api/files/:fileId/signatures` | Get signatures for file |
| GET | `/api/esignature/sign/:token` | Get signing page (public) |
| POST | `/api/esignature/sign` | Submit signature (public) |
| **Versions** |||
| GET | `/api/files/:id/versions` | Get version history |
| POST | `/api/files/:id/versions` | Create new version |
| POST | `/api/files/:id/versions/:vId/restore` | Restore version |
| **API Keys** |||
| GET | `/api/keys` | List API keys |
| POST | `/api/keys` | Create API key |
| DELETE | `/api/keys/:id` | Revoke API key |
| **External API** |||
| GET | `/api/v1/files` | List files (API key auth) |
| GET | `/api/v1/files/:id` | Get file details (API key auth) |

---

## Endpoints

### Authentication

#### POST /api/auth/login
Login with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "user": { "id": "uuid", "email": "user@example.com" },
  "session": { "access_token": "eyJ..." },
  "profile": { "display_name": "John Doe", "storage_quota_bytes": 10737418240 }
}
```

#### POST /api/auth/register
Create a new account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "displayName": "John Doe"
}
```

---

### Files

#### GET /api/files
List files in a folder.

**Query Parameters:**
- `folder_id` - Folder ID (null/empty for root)

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "document.pdf",
    "file_type": "application/pdf",
    "size_bytes": 1024000,
    "folder_id": null,
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

#### POST /api/files/merge-pdf
Merge multiple PDF files into one.

**Request:**
```json
{
  "file_ids": ["uuid1", "uuid2", "uuid3"],
  "output_name": "merged_document",
  "folder_id": null
}
```

**Response:**
```json
{
  "success": true,
  "file": { "id": "uuid", "name": "merged_document.pdf" },
  "merged_info": {
    "source_files": [
      { "id": "uuid1", "name": "doc1.pdf", "page_count": 5, "page_range": { "start": 1, "end": 5 } },
      { "id": "uuid2", "name": "doc2.pdf", "page_count": 3, "page_range": { "start": 6, "end": 8 } }
    ],
    "total_pages": 8,
    "output_size_bytes": 2048000
  }
}
```

#### POST /api/files/upload-url
Get a signed URL for direct upload to storage.

**Request:**
```json
{
  "fileName": "document.pdf",
  "fileType": "application/pdf",
  "folderId": null
}
```

**Response:**
```json
{
  "uploadUrl": "https://...",
  "storagePath": "user-id/timestamp_document.pdf",
  "token": "upload-token"
}
```

---

### Sharing

#### POST /api/files/:id/links
Create a public share link.

**Request:**
```json
{
  "permission_level": "viewer",
  "expires_at": "2024-12-31T23:59:59Z",
  "max_access_count": 100,
  "requires_password": true,
  "password": "secret123",
  "allow_download": true
}
```

**Response:**
```json
{
  "id": "uuid",
  "link_token": "abc123xyz",
  "shareUrl": "https://fileflow.app/share/abc123xyz",
  "embedUrl": "https://fileflow.app/embed/abc123xyz"
}
```

#### GET /api/share/:token
Access a shared file (public endpoint).

**Query Parameters:**
- `password` - Required if link has password protection

---

### E-Signature

#### POST /api/esignature/requests
Create a new signature request.

**Request:**
```json
{
  "title": "Employment Contract",
  "description": "Please sign the attached contract",
  "file_id": "uuid",
  "signatories": [
    { "name": "John Doe", "email": "john@example.com", "title": "Employee" },
    { "name": "Jane Smith", "email": "jane@example.com", "title": "HR Manager" }
  ],
  "expires_at": "2024-12-31T23:59:59Z"
}
```

**Response:**
```json
{
  "id": "uuid",
  "title": "Employment Contract",
  "status": "draft",
  "signatories": [
    { "id": "uuid", "name": "John Doe", "status": "pending", "access_token": "token1" }
  ]
}
```

#### POST /api/esignature/requests/:id/send
Send the signature request to all signatories.

#### GET /api/files/:fileId/signatures
Get all signature requests associated with a specific file.

---

### API Keys

#### POST /api/keys
Create an API key for external integrations.

**Request:**
```json
{
  "name": "My Integration",
  "permission_level": "read",
  "scope_type": "all",
  "expires_at": "2025-12-31T23:59:59Z"
}
```

**Response:**
```json
{
  "id": "uuid",
  "name": "My Integration",
  "key": "ff_abc123xyz789...",
  "key_prefix": "ff_abc123",
  "permission_level": "read",
  "message": "Save this key - it won't be shown again!"
}
```

---

### External API (API Key Auth)

These endpoints use API key authentication instead of user JWT.

#### GET /api/v1/files
List files accessible to the API key.

**Query Parameters:**
- `folder_id` - Filter by folder
- `limit` - Max results (default: 100)
- `offset` - Pagination offset (default: 0)

#### GET /api/v1/files/:id
Get file details with download URL.

**Response:**
```json
{
  "file": { "id": "uuid", "name": "document.pdf" },
  "downloadUrl": "https://signed-url...",
  "permission": "read"
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error message description"
}
```

**Common Status Codes:**
- `400` - Bad request (invalid input)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not found
- `500` - Server error

---

## Rate Limits

- User API: 100 requests/minute
- Public API (API Keys): 1000 requests/minute
- File uploads: 10 concurrent uploads

---

## Webhooks (Coming Soon)

FileFlow will support webhooks for:
- File uploaded
- File deleted
- Signature completed
- Share link accessed

---

## SDK Examples

### JavaScript/TypeScript
```typescript
import { api } from './lib/api';

// Login
const { session } = await api.login('user@example.com', 'password');

// List files
const files = await api.getFiles(folderId);

// Create signature request
const request = await api.createSignatureRequest({
  title: 'Contract',
  file_id: fileId,
  signatories: [{ name: 'John', email: 'john@example.com' }]
});

// Merge PDFs
const result = await api.mergePdf({
  file_ids: [id1, id2, id3],
  output_name: 'merged'
});
```

### cURL
```bash
# Login
curl -X POST http://localhost:8680/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# List files (with token)
curl http://localhost:8680/api/files \
  -H "Authorization: Bearer <token>"

# External API (with API key)
curl http://localhost:8680/api/v1/files \
  -H "Authorization: Bearer ff_your_api_key"
```

---

## OpenAPI Specification

Full OpenAPI 3.0 specification available at:
- [`docs/api.yaml`](./api.yaml)

Import into Swagger UI, Postman, or other API tools.
