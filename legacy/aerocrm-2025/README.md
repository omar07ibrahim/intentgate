# Legacy AeroCRM snapshot

This directory preserves the original repository tree from commit
`c7ba7c1165c2aeff8ae26dcc9ca6e9e82f9f8007` so its history is not erased
while the repository is rebuilt around a bounded, verifiable workflow core.

Every pre-existing file is retained byte-for-byte under this prefix. This
snapshot is historical evidence, not the supported application.

## Known limits

- `manage.py` is empty and no Django migrations or tests were committed.
- Python and JavaScript dependencies are ranges without complete lockfiles.
- Docker Compose exposes development services and uses placeholder credentials.
- Authentication, file-upload, and background-task behavior has not been
  independently verified.
- No production deployment, security, privacy, or performance claim is made.

Do not deploy the legacy snapshot or process real employee data with it.
