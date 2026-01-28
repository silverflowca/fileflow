# FileFlow Testing Guide

## Application URL
- **Local**: http://localhost:5176
- **Status**: ✅ Running (dev server)

## Test Scenarios

### 1. Authentication
- [ ] Register a new account
- [ ] Login with registered account
- [ ] Verify profile shows in header
- [ ] Check storage quota display (0 B / 5 GB initially)
- [ ] Logout and verify redirect to login

### 2. Folder Management (Phase 2)
- [ ] Click "New Folder" button
- [ ] Enter folder name (e.g., "Documents")
- [ ] Verify folder appears in grid
- [ ] Click folder to navigate into it
- [ ] Verify breadcrumb shows "My Files > Documents"
- [ ] Click "My Files" breadcrumb to go back to root
- [ ] Create nested folder inside Documents
- [ ] Click three-dot menu on folder
- [ ] Delete folder and confirm removal

### 3. File Upload (Phase 3)
- [ ] Click "Upload Files" button
- [ ] Drag and drop a file onto upload area
- [ ] Verify file appears in grid after upload
- [ ] Upload multiple files at once
- [ ] Try uploading file >500MB (should show error)
- [ ] Upload file to a specific folder (navigate to folder first)
- [ ] Verify storage quota increases in header

### 4. File Preview & Download
- [ ] Click on an image file
- [ ] Verify preview modal opens with image
- [ ] Click "Download" button in modal
- [ ] Verify file downloads with correct name
- [ ] Close modal with X button or click outside
- [ ] Test preview with:
  - [ ] Image (PNG, JPG)
  - [ ] Video (MP4)
  - [ ] Audio (MP3)
  - [ ] PDF document
  - [ ] Non-previewable file (shows message)

### 5. File Management
- [ ] Click three-dot menu on file
- [ ] Delete file and confirm
- [ ] Verify file removed from grid
- [ ] Verify storage quota decreases

### 6. File Type Icons
Verify correct emoji displays for:
- [ ] 🖼️ Images (.jpg, .png, .gif)
- [ ] 🎥 Videos (.mp4, .avi)
- [ ] 🎵 Audio (.mp3, .wav)
- [ ] 📄 PDFs
- [ ] 📝 Word documents
- [ ] 📊 Excel spreadsheets
- [ ] 📦 Archives (.zip)

### 7. Error Handling
- [ ] Try creating folder with empty name
- [ ] Try uploading file while not authenticated
- [ ] Try uploading extremely large file
- [ ] Check browser console for errors

## Database Schema

All data stored in `fileflow` schema:
- `fileflow.profiles` - User accounts
- `fileflow.folders` - Folder hierarchy
- `fileflow.files` - File metadata
- `storage.objects` (bucket: `files`) - Actual file data

## Key Features Implemented

✅ **Phase 2: Folder Management**
- Create folders
- Navigate folder hierarchy
- Delete folders
- Breadcrumb navigation
- Materialized path structure

✅ **Phase 3: File Upload**
- Drag & drop upload
- Multiple file support
- File size validation (500MB max)
- Storage quota tracking
- Supabase Storage integration

✅ **Bonus Features**
- File preview (images, videos, audio, PDFs)
- File download
- File type icons
- Storage bucket with RLS policies
- Responsive UI

## Known Limitations

1. **Breadcrumbs**: Currently only shows immediate parent (not full path)
2. **File versions**: Not implemented yet (schema ready)
3. **Permissions**: Not enforced yet (schema ready)
4. **Search**: Not implemented yet
5. **Thumbnails**: Not generated yet (schema ready)

## Next Steps (Future Phases)

- Phase 4: Chunked Upload (for resumable large files)
- Phase 5: Thumbnails & Preview optimization
- Phase 6: Audio Recording
- Phase 7: Permissions System
- Phase 8: Public Links
- Phase 9: Search & Filters
- Phase 10: Polish & Optimization
