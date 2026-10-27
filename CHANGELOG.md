# Changelog

## [1.2.1] - 2026-10-26

### Fixed

- Pointed the default Components catalog manifest and raw URLs at the renamed
  `slicejs-components` repository. The old `slice.js_visual_library` URLs relied on GitHub redirects.
- Environment overrides (`SLICE_COMPONENTS_MANIFEST_URL`, `SLICE_COMPONENTS_RAW_BASE_URL`) still
  take precedence.

## [1.2.0] - 2026-10-23

### Added

- Added separate framework and Slice.js Components documentation catalogs.
- Added namespace-aware list, search, and Markdown retrieval tools for both catalogs.
- Added catalog revision, version, source path, and raw URL metadata.
- Added environment overrides for framework and Components documentation mirrors.

### Changed

- Clarified that the original unnamespaced tools target the framework documentation catalog.
