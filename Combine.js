var imageCollection = ee.ImageCollection("COPERNICUS/S1_GRD"),
    imageCollection2 = ee.ImageCollection("MODIS/061/MCD64A1"),
    imageCollection3 = ee.ImageCollection("ESA/CCI/FireCCI/5_1"),
    imageCollection4 = ee.ImageCollection("COPERNICUS/S1_GRD"),
    table = ee.FeatureCollection("FAO/GAUL/2015/level2"),
    imageCollection5 = ee.ImageCollection("MODIS/061/MCD64A1"),
    imageCollection6 = ee.ImageCollection("FIRMS"),
    imageCollection7 = ee.ImageCollection("JRC/GHSL/P2023A/GHS_POP"),
    imageCollection8 = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2"),
    image = ee.Image("USGS/SRTMGL1_003"),
    geometry = 
    /* color: #23cba7 */
    /* shown: false */
    ee.Geometry.MultiPoint();
    
    
    C:\Users\renge\Documents\CASA\Documents\CASA\CASA25