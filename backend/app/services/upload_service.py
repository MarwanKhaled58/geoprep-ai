from pathlib import Path
from uuid import uuid4

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
