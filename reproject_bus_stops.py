import geopandas as gpd

input_file = r"D:\pregeo\geoprep-ai\bus-stops.geojson"
output_file = r"D:\pregeo\geoprep-ai\bus-stops_epsg32618.geojson"

gdf = gpd.read_file(input_file)

print("Original CRS:", gdf.crs)

gdf_32618 = gdf.to_crs(epsg=32618)

print("New CRS:", gdf_32618.crs)

gdf_32618.to_file(output_file, driver="GeoJSON")

print("Saved:", output_file)
