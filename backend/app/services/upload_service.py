from pathlib import Path
from uuid import uuid4
from zipfile import BadZipFile, ZipFile
from io import BytesIO

from fastapi import UploadFile

from app.core.config import UPLOAD_DIR
from app.gis.file_inspector import inspect_gis_file
from app.services.dataset_session_service import (
    add_uploaded_file_to_dataset_session,
    get_or_create_dataset_session,
)
from app.services.file_classifier_service import classify_file
from app.services.file_readiness_service import generate_file_readiness_report
from app.services.file_warning_service import generate_file_warnings
from app.services.upload_validation_service import validate_uploaded_file


SHAPEFILE_COMPONENT_EXTENSIONS = {".shp", ".shx", ".dbf", ".prj"}
REQUIRED_SHAPEFILE_SIDECARS = {".shx", ".dbf"}


async def save_uploaded_file(
    file: UploadFile,
    dataset_session_id: str | None = None,
) -> dict:
    """
    Validate, save, classify, inspect, warn, analyze readiness, and attach
    an uploaded file to a dataset session.

    If no dataset session is provided, a new one is created automatically.
    """

    content = await validate_uploaded_file(file)

    dataset_session = get_or_create_dataset_session(dataset_session_id)
    active_dataset_session_id = dataset_session["dataset_session_id"]

    if _is_zip_file(file.filename or ""):
        return _save_zip_upload(
            original_filename=file.filename or "uploaded_file.zip",
            content=content,
            content_type=file.content_type,
            dataset_session_id=active_dataset_session_id,
        )

    return _save_upload_content(
        original_filename=file.filename or "uploaded_file",
        content=content,
        content_type=file.content_type,
        dataset_session_id=active_dataset_session_id,
    )


async def save_multiple_uploaded_files(
    files: list[UploadFile],
    dataset_session_id: str | None = None,
) -> dict:
    """
    Upload multiple files and attach all logical files to the same dataset session.
    """

    dataset_session = get_or_create_dataset_session(dataset_session_id)
    active_dataset_session_id = dataset_session["dataset_session_id"]

    upload_results: list[dict] = []
    shapefile_groups = _group_shapefile_uploads(files)
    processed_indices: set[int] = set()

    for index, file in enumerate(files):
        if index in processed_indices:
            continue

        filename = file.filename or "uploaded_file"
        shapefile_base = _get_shapefile_base(filename)

        if _is_zip_file(filename):
            content = await validate_uploaded_file(file)
            upload_result = _save_zip_upload(
                original_filename=filename,
                content=content,
                content_type=file.content_type,
                dataset_session_id=active_dataset_session_id,
            )
            upload_results.append(upload_result)
            processed_indices.add(index)
            continue

        if shapefile_base and shapefile_base in shapefile_groups:
            if _is_shapefile_main(filename):
                group_indices = shapefile_groups[shapefile_base]
                group_files = [files[group_index] for group_index in group_indices]
                upload_result = await _save_shapefile_group(
                    files=group_files,
                    dataset_session_id=active_dataset_session_id,
                )
                upload_results.append(upload_result)
                processed_indices.update(group_indices)
            else:
                processed_indices.add(index)

            continue

        upload_result = await save_uploaded_file(
            file=file,
            dataset_session_id=active_dataset_session_id,
        )

        upload_results.append(upload_result)
        processed_indices.add(index)

    final_dataset_session = (
        upload_results[-1]["dataset_session"]
        if upload_results
        else dataset_session
    )

    return {
        "status": "success",
        "message": "Multiple files uploaded, inspected, analyzed, and attached to dataset session successfully",
        "file_count": len(upload_results),
        "dataset_session_id": active_dataset_session_id,
        "dataset_session": final_dataset_session,
        "uploads": upload_results,
    }


def _save_upload_content(
    original_filename: str,
    content: bytes,
    content_type: str | None,
    dataset_session_id: str,
    saved_stem: str | None = None,
) -> dict:
    """
    Save, inspect, warn, analyze readiness, and attach one logical upload.
    """

    session_upload_dir = UPLOAD_DIR / dataset_session_id
    session_upload_dir.mkdir(parents=True, exist_ok=True)

    file_classification = classify_file(original_filename)

    file_extension = Path(original_filename).suffix.lower()
    saved_filename = f"{saved_stem or uuid4().hex}{file_extension}"
    saved_path = session_upload_dir / saved_filename

    with open(saved_path, "wb") as output_file:
        output_file.write(content)

    gis_inspection = inspect_gis_file(
        file_path=str(saved_path),
        file_category=file_classification["file_category"],
        display_filename=original_filename,
    )

    warnings = generate_file_warnings(
        file_classification=file_classification,
        gis_inspection=gis_inspection,
    )

    readiness_report = generate_file_readiness_report(
        file_classification=file_classification,
        gis_inspection=gis_inspection,
        warnings=warnings,
    )

    upload_result = {
        "status": "success",
        "message": "File uploaded, validated, saved, classified, inspected, checked for warnings, analyzed for readiness, and attached to dataset session successfully",
        "original_filename": original_filename,
        "saved_filename": saved_filename,
        "content_type": content_type,
        "file_size_bytes": len(content),
        "saved_path": str(saved_path),
        "gis_metadata": gis_inspection,
        "warnings": warnings,
        "readiness_report": readiness_report,
        "dataset_session_id": dataset_session_id,
        **file_classification,
    }

    updated_dataset_session = add_uploaded_file_to_dataset_session(
        dataset_session_id=dataset_session_id,
        upload_result=upload_result,
    )

    upload_result["dataset_session"] = updated_dataset_session

    return upload_result


async def _save_shapefile_group(
    files: list[UploadFile],
    dataset_session_id: str,
) -> dict:
    """
    Save a shapefile component group and inspect only the main .shp file.
    """

    components = {
        Path(file.filename or "uploaded_file").suffix.lower(): file
        for file in files
        if _is_shapefile_component(file.filename or "")
    }
    main_file = components[".shp"]
    saved_stem = uuid4().hex
    session_upload_dir = UPLOAD_DIR / dataset_session_id
    session_upload_dir.mkdir(parents=True, exist_ok=True)
    sidecar_metadata = []
    saved_component_paths: dict[str, Path] = {}
    component_contents: dict[str, bytes] = {}

    for extension, file in components.items():
        content = await validate_uploaded_file(file)
        component_contents[extension] = content
        original_filename = file.filename or f"uploaded_file{extension}"
        saved_filename = f"{saved_stem}{extension}"
        saved_path = session_upload_dir / saved_filename

        with open(saved_path, "wb") as output_file:
            output_file.write(content)

        saved_component_paths[extension] = saved_path

        if extension != ".shp":
            sidecar_metadata.append(
                {
                    "original_filename": original_filename,
                    "saved_filename": saved_filename,
                    "file_extension": extension,
                }
            )

    original_filename = main_file.filename or "uploaded_file.shp"
    file_classification = classify_file(original_filename)
    main_saved_path = saved_component_paths[".shp"]

    gis_inspection = inspect_gis_file(
        file_path=str(main_saved_path),
        file_category=file_classification["file_category"],
        display_filename=original_filename,
    )
    metadata = gis_inspection.setdefault("metadata", {})
    metadata["shapefile_sidecars"] = sidecar_metadata

    warnings = generate_file_warnings(
        file_classification=file_classification,
        gis_inspection=gis_inspection,
    )

    readiness_report = generate_file_readiness_report(
        file_classification=file_classification,
        gis_inspection=gis_inspection,
        warnings=warnings,
    )

    main_upload_result = {
        "status": "success",
        "message": "Shapefile group uploaded, validated, saved, classified, inspected, checked for warnings, analyzed for readiness, and attached to dataset session successfully",
        "original_filename": original_filename,
        "saved_filename": main_saved_path.name,
        "content_type": main_file.content_type,
        "file_size_bytes": len(component_contents[".shp"]),
        "saved_path": str(main_saved_path),
        "gis_metadata": gis_inspection,
        "warnings": warnings,
        "readiness_report": readiness_report,
        "dataset_session_id": dataset_session_id,
        **file_classification,
    }

    updated_dataset_session = add_uploaded_file_to_dataset_session(
        dataset_session_id=dataset_session_id,
        upload_result=main_upload_result,
    )

    main_upload_result["dataset_session"] = updated_dataset_session

    return main_upload_result


def _save_zip_upload(
    original_filename: str,
    content: bytes,
    content_type: str | None,
    dataset_session_id: str,
) -> dict:
    """
    Save a ZIP shapefile package as one logical vector upload when possible.
    """

    try:
        zip_members = _collect_safe_zip_members(content)
    except BadZipFile:
        return _save_upload_content(
            original_filename=original_filename,
            content=content,
            content_type=content_type,
            dataset_session_id=dataset_session_id,
        )
    except ValueError as exc:
        return _save_failed_zip_shapefile_upload(
            original_filename=original_filename,
            content_type=content_type,
            file_size_bytes=len(content),
            dataset_session_id=dataset_session_id,
            inspection_error=str(exc),
        )

    shapefile_groups = _group_zip_shapefile_members(zip_members)

    if not shapefile_groups:
        return _save_upload_content(
            original_filename=original_filename,
            content=content,
            content_type=content_type,
            dataset_session_id=dataset_session_id,
        )

    complete_groups = [
        group
        for group in shapefile_groups.values()
        if _is_complete_shapefile_member_group(group)
    ]

    if complete_groups:
        return _save_zip_shapefile_group(
            zip_filename=original_filename,
            zip_file_size_bytes=len(content),
            content_type=content_type,
            dataset_session_id=dataset_session_id,
            group=complete_groups[0],
            multiple_shapefiles_found=len(shapefile_groups) > 1,
        )

    first_group = next(iter(shapefile_groups.values()))
    main_member = first_group.get(".shp")
    display_filename = (
        Path(main_member["filename"]).name if main_member else original_filename
    )
    missing_extensions = _get_missing_required_shapefile_extensions(first_group)

    return _save_failed_zip_shapefile_upload(
        original_filename=display_filename,
        content_type=content_type,
        file_size_bytes=len(content),
        dataset_session_id=dataset_session_id,
        inspection_error=(
            f"Incomplete ZIP shapefile package. {original_filename} contains "
            f"{display_filename}, but it is missing required sidecar file(s): "
            f"{', '.join(missing_extensions)}."
        ),
    )


def _save_zip_shapefile_group(
    zip_filename: str,
    zip_file_size_bytes: int,
    content_type: str | None,
    dataset_session_id: str,
    group: dict[str, dict],
    multiple_shapefiles_found: bool,
) -> dict:
    """
    Save one complete shapefile group from a ZIP and inspect the .shp.
    """

    saved_stem = uuid4().hex
    session_upload_dir = UPLOAD_DIR / dataset_session_id
    session_upload_dir.mkdir(parents=True, exist_ok=True)
    saved_component_paths: dict[str, Path] = {}
    sidecar_metadata = []

    for extension, member in group.items():
        saved_filename = f"{saved_stem}{extension}"
        saved_path = session_upload_dir / saved_filename

        with open(saved_path, "wb") as output_file:
            output_file.write(member["content"])

        saved_component_paths[extension] = saved_path

        if extension != ".shp":
            sidecar_metadata.append(
                {
                    "original_filename": Path(member["filename"]).name,
                    "zip_member": member["filename"],
                    "saved_filename": saved_filename,
                    "file_extension": extension,
                }
            )

    main_member = group[".shp"]
    original_filename = Path(main_member["filename"]).name
    file_classification = classify_file(original_filename)
    main_saved_path = saved_component_paths[".shp"]

    gis_inspection = inspect_gis_file(
        file_path=str(main_saved_path),
        file_category=file_classification["file_category"],
        display_filename=original_filename,
    )
    metadata = gis_inspection.setdefault("metadata", {})
    metadata["source_zip"] = zip_filename
    metadata["source_zip_member"] = main_member["filename"]
    metadata["shapefile_sidecars"] = sidecar_metadata

    warnings = generate_file_warnings(
        file_classification=file_classification,
        gis_inspection=gis_inspection,
    )

    if multiple_shapefiles_found:
        warnings.append(
            {
                "code": "MULTIPLE_SHAPEFILES_IN_ZIP",
                "severity": "info",
                "message": (
                    "Multiple shapefiles were found in the ZIP package. "
                    "GeoPrep AI inspected the first complete shapefile group."
                ),
                "recommended_action": (
                    "Upload separate ZIP packages if each shapefile should be "
                    "reviewed as a separate dataset input."
                ),
                "details": {"source_zip": zip_filename},
            }
        )

    readiness_report = generate_file_readiness_report(
        file_classification=file_classification,
        gis_inspection=gis_inspection,
        warnings=warnings,
    )

    upload_result = {
        "status": "success",
        "message": "ZIP shapefile package uploaded, extracted, inspected, checked for warnings, analyzed for readiness, and attached to dataset session successfully",
        "original_filename": original_filename,
        "saved_filename": main_saved_path.name,
        "content_type": content_type,
        "file_size_bytes": zip_file_size_bytes,
        "saved_path": str(main_saved_path),
        "gis_metadata": gis_inspection,
        "warnings": warnings,
        "readiness_report": readiness_report,
        "dataset_session_id": dataset_session_id,
        **file_classification,
    }

    updated_dataset_session = add_uploaded_file_to_dataset_session(
        dataset_session_id=dataset_session_id,
        upload_result=upload_result,
    )

    upload_result["dataset_session"] = updated_dataset_session

    return upload_result


def _save_failed_zip_shapefile_upload(
    original_filename: str,
    content_type: str | None,
    file_size_bytes: int,
    dataset_session_id: str,
    inspection_error: str,
) -> dict:
    """
    Return an UploadResponse-style failed vector result for ZIP shapefile packages.
    """

    session_upload_dir = UPLOAD_DIR / dataset_session_id
    session_upload_dir.mkdir(parents=True, exist_ok=True)

    saved_filename = f"{uuid4().hex}.shp"
    saved_path = session_upload_dir / saved_filename
    saved_path.write_bytes(b"")

    file_classification = classify_file(saved_filename)
    gis_inspection = _build_failed_zip_shapefile_inspection(inspection_error)

    warnings = generate_file_warnings(
        file_classification=file_classification,
        gis_inspection=gis_inspection,
    )

    readiness_report = generate_file_readiness_report(
        file_classification=file_classification,
        gis_inspection=gis_inspection,
        warnings=warnings,
    )

    upload_result = {
        "status": "success",
        "message": "ZIP shapefile package uploaded, but the shapefile group is incomplete.",
        "original_filename": original_filename,
        "saved_filename": saved_filename,
        "content_type": content_type,
        "file_size_bytes": file_size_bytes,
        "saved_path": str(saved_path),
        "gis_metadata": gis_inspection,
        "warnings": warnings,
        "readiness_report": readiness_report,
        "dataset_session_id": dataset_session_id,
        **file_classification,
    }

    updated_dataset_session = add_uploaded_file_to_dataset_session(
        dataset_session_id=dataset_session_id,
        upload_result=upload_result,
    )

    upload_result["dataset_session"] = updated_dataset_session

    return upload_result


def _collect_safe_zip_members(content: bytes) -> list[dict]:
    """
    Read ZIP members without extracting unsafe paths.
    """

    members: list[dict] = []

    with ZipFile(BytesIO(content)) as zip_file:
        for zip_info in zip_file.infolist():
            if zip_info.is_dir():
                continue

            member_path = Path(zip_info.filename.replace("\\", "/"))

            if _is_unsafe_zip_member_path(member_path):
                raise ValueError(
                    "ZIP package contains an unsafe file path and was not processed."
                )

            members.append(
                {
                    "filename": member_path.as_posix(),
                    "content": zip_file.read(zip_info),
                }
            )

    return members


def _group_zip_shapefile_members(members: list[dict]) -> dict[str, dict[str, dict]]:
    """
    Group shapefile components inside a ZIP by basename.
    """

    groups: dict[str, dict[str, dict]] = {}

    for member in members:
        filename = member["filename"]

        if not _is_shapefile_component(filename):
            continue

        shapefile_base = _get_shapefile_base(filename)
        extension = Path(filename).suffix.lower()

        if shapefile_base is None:
            continue

        groups.setdefault(shapefile_base, {})[extension] = member

    return {
        shapefile_base: group
        for shapefile_base, group in groups.items()
        if ".shp" in group
    }


def _is_complete_shapefile_member_group(group: dict[str, dict]) -> bool:
    """
    Return True when a ZIP shapefile group has required components.
    """

    return ".shp" in group and REQUIRED_SHAPEFILE_SIDECARS.issubset(group.keys())


def _get_missing_required_shapefile_extensions(group: dict[str, dict]) -> list[str]:
    """
    Return missing required shapefile sidecar extensions for a ZIP group.
    """

    return [
        extension
        for extension in sorted(REQUIRED_SHAPEFILE_SIDECARS)
        if extension not in group
    ]


def _is_unsafe_zip_member_path(member_path: Path) -> bool:
    """
    Prevent absolute paths or traversal paths from ZIP packages.
    """

    return (
        member_path.is_absolute()
        or any(part in {"..", ""} for part in member_path.parts)
        or any(":" in part for part in member_path.parts)
    )


def _build_failed_zip_shapefile_inspection(inspection_error: str) -> dict:
    """
    Build a failed vector inspection object for an incomplete ZIP shapefile.
    """

    return {
        "is_gis_file": True,
        "gis_type": "vector",
        "inspection_status": "failed",
        "inspection_error_code": "ZIP_INCOMPLETE_SHAPEFILE",
        "inspection_error": inspection_error,
        "crs": {
            "has_crs": False,
            "crs_text": None,
            "epsg": None,
            "authority": None,
        },
        "metadata": {
            "inspection_error_code": "ZIP_INCOMPLETE_SHAPEFILE",
            "inspection_error": inspection_error,
        },
    }


def _group_shapefile_uploads(files: list[UploadFile]) -> dict[str, list[int]]:
    """
    Group uploaded shapefile components by original basename.
    """

    grouped_indices: dict[str, list[int]] = {}
    groups_with_main_file: set[str] = set()

    for index, file in enumerate(files):
        filename = file.filename or ""

        if not _is_shapefile_component(filename):
            continue

        shapefile_base = _get_shapefile_base(filename)

        if shapefile_base is None:
            continue

        grouped_indices.setdefault(shapefile_base, []).append(index)

        if _is_shapefile_main(filename):
            groups_with_main_file.add(shapefile_base)

    return {
        shapefile_base: indices
        for shapefile_base, indices in grouped_indices.items()
        if shapefile_base in groups_with_main_file
    }


def _is_shapefile_component(filename: str) -> bool:
    """
    Return True when a filename belongs to a shapefile component.
    """

    return Path(filename).suffix.lower() in SHAPEFILE_COMPONENT_EXTENSIONS


def _is_zip_file(filename: str) -> bool:
    """
    Return True when a filename is a ZIP package.
    """

    return Path(filename).suffix.lower() == ".zip"


def _is_shapefile_main(filename: str) -> bool:
    """
    Return True when a filename is the main .shp file.
    """

    return Path(filename).suffix.lower() == ".shp"


def _get_shapefile_base(filename: str) -> str | None:
    """
    Return a case-insensitive shapefile basename for grouping.
    """

    if not _is_shapefile_component(filename):
        return None

    return Path(filename).stem.lower()
