var imageCollection = ee.ImageCollection("COPERNICUS/S1_GRD"),
    table = ee.FeatureCollection("FAO/GAUL/2015/level2"),
    imageCollection3 = ee.ImageCollection("MODIS/061/MCD64A1"),
    imageCollection2 = ee.ImageCollection("FIRMS"),
    imageCollection4 = ee.ImageCollection("JRC/GHSL/P2023A/GHS_POP"),
    imageCollection6 = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2"),
    geometry = 
    /* color: #d63000 */
    /* shown: false */
    ee.Geometry.MultiPolygon(
        [[[[137.02622107164706, 37.386560310708205],
           [137.02622107164706, 37.323792474391794],
           [137.17796972887362, 37.323792474391794],
           [137.17796972887362, 37.386560310708205]]],
         [[[136.97746924059237, 37.35600165997617],
           [136.97746924059237, 37.27408682242268],
           [137.09282568590487, 37.27408682242268],
           [137.09282568590487, 37.35600165997617]]]], null, false),
    geometry2 = 
    /* color: #98ff00 */
    /* shown: false */
    ee.Geometry.MultiPolygon(
        [[[[136.84631994860018, 37.35381842290375],
           [136.84631994860018, 37.343447179655094],
           [137.022787844108, 37.343447179655094],
           [137.022787844108, 37.35381842290375]]],
         [[[136.91704443590487, 37.37019115303339],
           [136.91704443590487, 37.27135479072312],
           [137.13471106188143, 37.27135479072312],
           [137.13471106188143, 37.37019115303339]]]], null, false);

// Set up the Area of Interest (AOI)
var point = ee.Geometry.Point([136.89961, 37.39405]); // Center point
var aoi = point.buffer(10000); // 10 km buffer around the point

// Define the time range for pre- and post-event analysis
var preStart = '2023-08-01';
var preEnd = '2023-12-31';
var postStart = '2024-01-02';
var postEnd = '2024-03-31';

// Load the Sentinel-2 Image Collection within the specified dates and area
var s2 = ee.ImageCollection('COPERNICUS/S2')
          .filterBounds(aoi)
          .filterDate(preStart, postEnd)
          .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10));

// Function to calculate NDVI
function addNDVI(image) {
  var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
  return image.addBands(ndvi);
}

// Apply the NDVI function to each image in the collection
var ndviCollection = s2.map(addNDVI);

// Compute median NDVI images for pre and post periods
var preNDVI = ndviCollection.filterDate(preStart, preEnd).median().select('NDVI');
var postNDVI = ndviCollection.filterDate(postStart, postEnd).median().select('NDVI');

// Calculate NDVI difference to highlight changes
var ndviDiff = postNDVI.subtract(preNDVI).rename('NDVI_Diff');
// Calculate NDVI difference
var ndviDifference = postNDVI.subtract(preNDVI);

// Sampling points for training
// Assume points are pre-classified as 1 (landslide) or 0 (no landslide)
var points = ee.FeatureCollection([
    ee.Feature(ee.Geometry.Point([137.1018965847964,37.45891870504624]), {label: 1}),
    ee.Feature(ee.Geometry.Point([136.8232291924816,37.34724623299005]), {label: 0})
]);

// Overlay the points on the NDVI difference to extract training data
var training = ndviDifference.sampleRegions({
    collection: points,
    properties: ['label'],
    scale: 10
});

// Train a Random Forest classifier
var classifier = ee.Classifier.smileRandomForest(50).train({
    features: training,
    classProperty: 'label',
    inputProperties: ['NDVI']
});

// Apply the classifier to the NDVI difference image
var classified = ndviDifference.classify(classifier);

// Load and filter additional datasets for roads and water bodies
var roads = ee.FeatureCollection('TIGER/2016/Roads').filterBounds(aoi);
var waterBodies = ee.FeatureCollection('HYCOM/sea_water_velocity');
//var buildings = ee.FeatureCollection('GlobalHumanSettlementLayer/GHS_BUILT_LDSMT_GLOBE_V1').filterBounds(aoi);


// Visualization parameters
var visParams = {
  bands: ['NDVI_Diff'],
  min: -0.5,
  max: 0.5,
  palette: ['blue', 'white', 'red']
};

var roadParams = {
  color: 'yellow',
  width: 1
};

var waterParams = {
  color: 'blue',
  width: 1
};
var clusterVis = {min: 0, max: 2, palette: ['cyan', 'orange', 'purple']};

// Create a map panel
var mapPanel_landslide = ui.Map();
mapPanel_landslide.centerObject(point, 14); // Center the map on the point
mapPanel_landslide.setOptions("SATELLITE"); // Set map type

// Add layers to the map.
mapPanel_landslide.add(ui.Map.Layer(preNDVI.select('NDVI'), {min: -1, max: 1, palette: ['blue', 'white', 'green']}, 'Pre-event NDVI', false));
mapPanel_landslide.add(ui.Map.Layer(postNDVI.select('NDVI'), {min: -1, max: 1, palette: ['blue', 'white', 'green']}, 'Post-event NDVI', false));
mapPanel_landslide.add(ui.Map.Layer(ndviDiff, visParams, 'NDVI Difference', false));
mapPanel_landslide.add(ui.Map.Layer(classified, {min: 0, max: 1, palette: ['blue', 'red'], opacity: 0.5}, 'Landslide Prediction', true));
mapPanel_landslide.add(ui.Map.Layer(roads.style(roadParams), {}, 'Roads', false));
mapPanel_landslide.add(ui.Map.Layer(waterBodies.style(waterParams), {}, 'Water Bodies', false));

// Add the map to the UI.
ui.root.add(mapPanel_landslide);
