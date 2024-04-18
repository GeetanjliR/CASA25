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
    
    
var aor = ee.Geometry.Polygon(
  [[
    [136.6996, 37.4903],
    [136.6996, 36.2903],
    [137.0996, 36.2903],
    [137.0996, 37.4903],
  ]]
);
function ttest(s1, shock, pre_interval, post_interval) {
  
  // Convert the shock date to a date object
  var shock = ee.Date(shock);
  // Filter the image collection to the pre-event period
  var pre = s1.filterDate(
    shock.advance(ee.Number(pre_interval).multiply(-1), "month"),
    shock
  );
  // Filter the image collection to the post-event period
  var post = s1.filterDate(shock, shock.advance(post_interval, "month"));
  
  // Calculate the mean, standard deviation, and number of images for the pre-event period
  var pre_mean = pre.mean();
  var pre_sd = pre.reduce(ee.Reducer.stdDev());
  var pre_n = ee.Number(pre.aggregate_array('orbitNumber_start').distinct().size());
  
  // Calculate the mean, standard deviation, and number of images for the pre-event period
  var post_mean = post.mean();
  var post_sd = post.reduce(ee.Reducer.stdDev());
  var post_n = ee.Number(post.aggregate_array('orbitNumber_start').distinct().size());
  
  // Calculate the pooled standard deviation
  var pooled_sd = pre_sd
    .multiply(pre_sd)
    .multiply(pre_n.subtract(1))
    .add(post_sd.multiply(post_sd).multiply(post_n.subtract(1)))
    .divide(pre_n.add(post_n).subtract(2))
    .sqrt();

    // Calculate the denominator of the t-test
  var denom = pooled_sd.multiply(
    ee.Number(1).divide(pre_n).add(ee.Number(1).divide(post_n)).sqrt()
  );

    // Calculate the Degrees of Freedom, which is the number of observations minus 2
  var df = pre_n.add(post_n).subtract(2);

  
  var change = post_mean
    .subtract(pre_mean)
    .divide(denom)
    .abs() //returning abs, so as t-value is bigger, the change becomes bigger.
    //.subtract(2);

    // return the t-values for each pixel
    return change
}

function filter_s1(path) {

  // Filter the image collection to the ascending or descending orbit
  var orbits = ee
    .ImageCollection("COPERNICUS/S1_GRD_FLOAT")
    .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VH"))
    .filter(ee.Filter.eq("instrumentMode", "IW"))
    .filter(ee.Filter.eq("orbitProperties_pass", path))
    .filterBounds(aor)
    .filterDate('2023-01-01','2024-04-15')
    .aggregate_array('relativeOrbitNumber_start')
    .distinct()
  
  print(orbits)
  
  var image_col=ee.ImageCollection(orbits.map(function(orbit){

  var s1 = ee
    .ImageCollection("COPERNICUS/S1_GRD_FLOAT")
    .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VH"))
    .filter(ee.Filter.eq("instrumentMode", "IW"))
    .filter(ee.Filter.eq("relativeOrbitNumber_start",orbit))
  
  
  // Calculate the t-test for the filtered image collection using the function we defined earlier
  var vv = ttest(s1.select("VV"), "2024-01-01", 12, 3.5)
  var vh = ttest(s1.select("VH"), '2024-01-01', 12, 3.5)
  var vv= vv.rename('change');
  var vh= vh.rename('change');
  
    // Return the t-values for each pixel
  var image=ee.ImageCollection([vv,vh]).mean()

  return image
  })).mean()
  
  return image_col
    
  }



// ------------------------------------- USER INTERFACE -------------------------------------


var homeButton=ui.Button({
  label:"Home",
  onClick: function(){
    clear()
    Map.add(footagePanel)
  }
  ,
  style:{stretch: "horizontal"}

})


var start = "2023-01-01";
//var now = Date.now();
var now='2024-03-31'
var end = ee.Date(now).format();

var drawButton = ui.Button({
  label: "🔺" + " Draw a Polygon",
  onClick: drawPolygon,
  style: { stretch: "horizontal" },
});

var outputLabel=ui.Label()
var footagePanel = ui.Panel({
  widgets: [
    ui.Label("Damage Assessment", {
      fontWeight: "bold",
      fontSize: "20px",
    }),
    ui.Label(
      "Click the button below and draw a box on the map to get an estimate of the number of damaged buildings in a given area",
      { whiteSpace: "wrap" }
    ),
    
    drawButton,
    ui.Label(),
  ],
  style: { position: "top-left", maxWidth: "350px", maxHeight:'90%'},
  layout: ui.Panel.Layout.flow("vertical", true),
});


var drawingTools = Map.drawingTools();

drawingTools.setShown(false);

while (drawingTools.layers().length() > 0) {
  var layer = drawingTools.layers().get(0);
  drawingTools.layers().remove(layer);
}

var dummyGeometry = ui.Map.GeometryLayer({
  geometries: null,
  name: "geometry",
  color: "23cba7",
}).setShown(false);

drawingTools.layers().add(dummyGeometry)


function clearGeometry() {
  var layers = drawingTools.layers();
  layers.get(0).geometries().remove(layers.get(0).geometries().get(0));
}

function drawPolygon() {
  clearGeometry();
  drawingTools.setShape("rectangle");
  drawingTools.draw();
}

function drawPoint() {
  clearGeometry();
  drawingTools.setShape("point");
  var pointBuffer = point.buffer({'distance': 100});
  drawingTools.draw();
}



function makeColorBarParams(palette) {
  return {
    bbox: [0, 0, 1, 0.1],
    dimensions: "100x10",
    format: "png",
    min: 0,
    max: 1,
    palette: palette.reverse(),
  };
}
var reds = ["yellow", "red","purple"];

// Create the color bar for the legend.
var colorBar = ui.Thumbnail({
  image: ee.Image.pixelLonLat().select(0),
  params: makeColorBarParams(reds.reverse()),
  style: { stretch: "horizontal", margin: "0px 8px", maxHeight: "24px" },
});

var legendTitle = ui.Label({
  value: "Estimated Damage",
  style: { fontWeight: "bold" ,textAlign: "center",stretch: "horizontal"},
});

var legendLabels = ui.Panel({
  widgets: [
    ui.Label('Low', { margin: "4px 8px" }),
    ui.Label( " ", {
      margin: "4px 8px",
      textAlign: "center",
      stretch: "horizontal",
    }),
    ui.Label('High', { margin: "4px 8px" }),
  ],
  layout: ui.Panel.Layout.flow("horizontal"),
});

var legendPanel = ui.Panel({
  widgets: [legendTitle, colorBar,legendLabels],
  style: { position: "bottom-left", Width: "350px"},
});



// -------------------------------------- CREATE BUTTON ----------------------------------------------
var layerSelect = ui.Select({
  items: ['DAMAGED BUILDING', 'LANDSLIDE', 'FIRE', 'TSUNAMI' ],
  value: 'DAMAGED BUILDING', //initial setting
  onChange: updateLayer, // 
  style: { stretch: 'horizontal', position: 'bottom-right' }
});

var buttonPanel = ui.Panel({
　widgets: [layerSelect],
  style: { position: 'bottom-right' }
});


// -------------------------------------- SETUP ----------------------------------------------
// created mapPanel_building
var mapPanel_building = ui.Map();
mapPanel_building.setOptions('SATELLITE');
// show mapPanel_building
ui.root.widgets().set(0, mapPanel_building);

function footprints(cutoff, aoi, label) {
  var footprints = ee.FeatureCollection('projects/ee-rengeanzu/assets/location-points-to-polygonss')
    .filterBounds(aoi)
    .map(function(feat) {
      return feat.set('area', feat.geometry().area(10)).set('geometry_type', feat.geometry().type());
    })
    .filter(ee.Filter.gt('area', 50));

  var mean = image.reduceRegions({
    collection: footprints,
    reducer: ee.Reducer.mean(),
    scale: 10
  });
  var damaged = mean.filter(ee.Filter.gt('mean', cutoff))

  print(damaged.size())

  var totalCount = mean.size()
  var damagedCount = damaged.size()
  var proportion = ((damagedCount.divide(totalCount)).multiply(100)).int() // .evaluate(function(val){return val});


  var outlines = ui.Map.Layer(damaged, {
    color: 'red'
  }, 'footprints');

  mapPanel_building.layers().set(0, outlines)
  mapPanel_building.layers().get(0).setShown(true)
  mapPanel_building.layers().get(1).setShown(false)
}



function clear() {

  mapPanel_building.clear()

  mapPanel_building.setOptions('SATELLITE')
  mapPanel_building.setControlVisibility({
    all: false
  });
  mapPanel_building.setControlVisibility({
    layerList: true,
    mapTypeControl: true
  });

  var urban = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1').filterDate('2023-01-01', '2024-03-31').mean().select('built')

  var boxcar = ee.Kernel.gaussian({
    radius: 50,
    units: 'meters',
    normalize: true,
    sigma: 20
  });

  // Call the filter_s1 function once for each orbit, and then combine the two images into a single image

  var desc = filter_s1("DESCENDING")


  var image = ee
    .ImageCollection([desc]).mean().convolve(boxcar)
    .updateMask(urban.gt(0.3))



  // Add the composite to the map
  var reds = ["yellow", "red", "purple"];

  // Add the composite to the map
  var damage_layer = ui.Map.Layer(
    image.updateMask(image.gt(2.5)), {
      min: 2.5,
      max: 6,
      opacity: 0.8,
      palette: reds
    },
    "change"
  );

  var initialPoint = ee.Geometry.Point(136.89961, 37.39405);

  mapPanel_building.layers().set(0, damage_layer)
  mapPanel_building.style().set("cursor", "crosshair");
  mapPanel_building.centerObject(initialPoint, 14);
  mapPanel_building.add(legendPanel);


  return image
}


function home() {
  var image = clear()


  mapPanel_building.add(footagePanel)
  return image
}

function footprints() {

  var aoi = drawingTools.layers().get(0).getEeObject();
  drawingTools.layers().get(0).setShown(false);

  var footprints = ee.FeatureCollection('projects/ee-rengeanzu/assets/location-points-to-polygons')
    .filterBounds(aoi)
    .map(function(feat) {
      return feat.set('area', feat.geometry().area(10)).set('geometry_type', feat.geometry().type());

    })
    .filter(ee.Filter.gt('area', 50)) //area
    .filter(ee.Filter.equals('geometry_type', 'Polygon'));

  var mean = image.reduceRegions({
    collection: footprints,
    reducer: ee.Reducer.mean(),
    scale: 10
  });
  var damaged = mean.filter(ee.Filter.gt('mean', 1.96)) //95% confidence period

  var totalCount = mean.size()
  var damagedCount = damaged.size()
  var proportion = ((damagedCount.divide(totalCount)).multiply(100)).int() // .evaluate(function(val){return val});

  var sumLabel2 = ui.Label({
    value: 'Calculating...'
  })
  var meanLabel2 = ui.Label({
    value: 'Calculating...'
  })

  damagedCount.evaluate(function(val) {
    sumLabel2.setValue(val)
  });
  proportion.evaluate(function(val) {
    meanLabel2.setValue(val)
  });

  var sumLabel1 = ui.Label("Number of damaged buildings in the area: ")
  var meanLabel1 = ui.Label("Proportion (%): ")

  var sumPanel = ui.Panel({
    layout: ui.Panel.Layout.flow('horizontal'),
    widgets: [sumLabel1, sumLabel2]
  })
  var meanPanel = ui.Panel({
    layout: ui.Panel.Layout.flow('horizontal'),
    widgets: [meanLabel1, meanLabel2]
  })

  var statsPanel = ui.Panel([sumPanel, meanPanel])

  footagePanel.widgets().set(4, statsPanel);

  Export.table.toDrive({
    collection: damaged,
    description: '_damaged_buildings',
  });

  Export.image.toDrive({
    image: image.clip(aoi),
    scale: 10,
    description: '_damage',
  });

  var outlines = ui.Map.Layer(damaged, {
    color: 'red'
  }, 'footprints');

  mapPanel_building.layers().set(1, outlines)
  mapPanel_building.layers().get(0).setShown(false)
}

var image = home()

drawingTools.onDraw(footprints);

mapPanel_building.add(buttonPanel);



//----------LAND SLIDE--------------------------------------------------------------------------------------------------------------------------------------------
//LANDSLIDE DETECTION LAYER AND MASKED LAYER Create a UI panel
var panel = ui.Panel({style: {width: '400px'}});
var mapPanel = ui.Map();

// Create a label
var titleLabel = ui.Label('Landslide Detection Visualization Tool');
panel.add(titleLabel);

// Add panel and map to the interface
////ui.root.clear();
////ui.root.add(panel);
////ui.root.add(mapPanel);

// Set the center of the landslide area
var center = {lon: 136.89961, lat: 37.39405, zoom: 10};

// Create a circular buffer around the center
var bufferRadius = 15000; // in meters
var aoi = ee.Geometry.Point(center.lon, center.lat).buffer(bufferRadius); 

// Load Sentinel-1 GRD imagery
var sentinel1 = ee.ImageCollection('COPERNICUS/S1_GRD')
                  .filterBounds(aoi)
                  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
                  .filter(ee.Filter.eq('orbitProperties_pass', 'DESCENDING'));

// Define the shock date
var shockDate = ee.Date('2024-01-01');

// Define the pre-event and post-event time intervals
var preInterval = 3; // Months before the shock date
var postInterval = 3; // Months after the shock date

// Filter the image collection to the pre-event period
var pre = sentinel1.filterDate(shockDate.advance(-preInterval, 'month'), shockDate);

// Filter the image collection to the post-event period
var post = sentinel1.filterDate(shockDate, shockDate.advance(postInterval, 'month'));

// Calculate mean difference between pre and post-event periods
var meanDiff = post.median().subtract(pre.median());

// Apply threshold to the difference image to create a mask
var mask = meanDiff.abs().gt(1); // Adjust the threshold as needed

// Create a masked layer to show the difference more clearly
var maskedDiff = meanDiff.updateMask(mask);

// Define visualization parameters for the original landslide detection layer
var visParamsOriginal = {
  bands: ['VV'],
  min: -3,
  max: 3,
  palette: ['blue', 'white', 'red']
};

// Define visualization parameters for the masked layer
var visParamsMasked = {
  bands: ['VV'],
  min: -3,
  max: 3,
  palette: ['blue', 'white', 'red'],
  opacity: 0.5 // Adjust the opacity of the masked layer as needed
};

// Add original landslide detection layer to the map
////mapPanel.addLayer(meanDiff.clip(aoi), visParamsOriginal, 'Landslide Detection');

// Add masked landslide detection layer to the map
////mapPanel.addLayer(maskedDiff.clip(aoi), visParamsMasked, 'Masked Landslide Detection');


// Set the map center and zoom level
////mapPanel.setCenter(center.lon, center.lat, center.zoom);


// EDITS tbm: Building footprint
// Multipoint code to clip anaysis to land?
// NDVI/NIR?
// Set threshold to improve on the display




//----------FIRE--------------------------------------------------------------------------------------------------------------------------------------------
var panel_fire = ui.Panel({style: {width: '400px'}});
var mapPanel_fire = ui.Map();

// Create a label
var titleLabel = ui.Label('Fire Burn Area Visualization Tool');
panel_fire.add(titleLabel);

// Dataset selection dropdown
var datasetSelector = ui.Select({
  items: ['ESA/CCI/FireCCI/5_1', 'MODIS/061/MCD64A1'],
  value: 'ESA/CCI/FireCCI/5_1',
  onChange: updateMap
});
panel_fire.add(ui.Label('Select Dataset'));
panel_fire.add(datasetSelector);

// Year selection slider
var yearSlider = ui.Slider({
  min: 2000,
  max: 2022,
  value: 2017,
  step: 1,
  onChange: updateMap
});
panel_fire.add(ui.Label('Select Year'));
panel_fire.add(yearSlider);

// Add panel and map to the interface
////ui.root.clear();
////ui.root.add(panel_fire);
////ui.root.add(mapPanel_fire);

function updateMap() {
  var datasetName = datasetSelector.getValue();
  var year = yearSlider.getValue();
  var startDate = ee.Date.fromYMD(year, 1, 1);
  var endDate = startDate.advance(1, 'year');

  var dataset = ee.ImageCollection(datasetName)
                  .filterDate(startDate, endDate);
  var burnedArea = dataset.select('BurnDate');
  var maxBurnedArea = burnedArea.max();
  
  // Set visualization parameters and center
  var visParams;
  var center;
  if (datasetName === 'ESA/CCI/FireCCI/5_1') {
    visParams = {min: 1, max: 366, palette: ['ff0000', 'fd4100', 'fb8200', 'f9c400', 'f2ff00', 'b6ff05',
    '7aff0a', '3eff0f', '02ff15', '00ff55', '00ff99', '00ffdd',
    '00ddff', '0098ff', '0052ff', '0210ff', '3a0dfb', '7209f6',
    'a905f1', 'e102ed', 'ff00cc', 'ff0089', 'ff0047', 'ff0004']};
    center = {lon: 6.746, lat: 46.529, zoom: 2};
  } else if (datasetName === 'MODIS/061/MCD64A1') {
    visParams = {min: 30.0, max: 341.0, palette: ['4e0400', '951003', 'c61503', 'ff1901']};
    center = {lon: 6.746, lat: 46.529, zoom: 2};
  }

  mapPanel_fire.clear();
  mapPanel_fire.setCenter(center.lon, center.lat, center.zoom);
  mapPanel_fire.addLayer(maxBurnedArea, visParams, 'Burned Area');
  mapPanel_fire.add(buttonPanel);
}

////updateMap();  // Initial map update




//----------TSUNAMI--------------------------------------------------------------------------------------------------------------------------------------------
// tsunami mapPanel
var mapPanel_tsunami = ui.Map();

// Set the map center and view mode
mapPanel_tsunami.setCenter(136.89961, 37.39405, 15);
mapPanel_tsunami.setOptions("SATELLITE");

// Define the Area of Interest (AOI) as a buffer around the center point of 3 kilometers
var aoi = ee.Geometry.Point(136.89961, 37.39405).buffer(3000);

// Load terrain elevation data
var elevation = ee.Image('USGS/SRTMGL1_003').clip(aoi);

// Load a CSV file containing building footprints, assuming it contains building outlines
var csv = ee.FeatureCollection('projects/ee-rengeanzu/assets/location-points-to-polygons').filterBounds(aoi);//<<changed

// Array of flood levels
var floodLevels = [1, 3, 5, 7, 9, 11];

// Initialize the previously flooded area
var previousFlooded = ee.Image.constant(0);

// Function: Compute and display affected buildings at specific water levels
function displayFloodImpact(floodLevel) {
    // Flooded area at the current water level
    var flooded = elevation.lte(floodLevel);
    
    // Exclude areas affected by previous water levels
    var newFlooded = flooded.and(previousFlooded.not());

    // Update the previous flooded area
    previousFlooded = previousFlooded.or(flooded);

    var floodedPoints = csv.map(function(feature) {
        return feature.set('isFlooded', newFlooded.reduceRegion({
            reducer: ee.Reducer.first(),
            geometry: feature.geometry(),
            scale: 10 //<<changed
        }).get('elevation'));
    }).filter(ee.Filter.eq('isFlooded', 1));

    // Visualize buildings affected by the flood
    mapPanel_tsunami.addLayer(floodedPoints, {color: ['blue', 'green', 'yellow', 'orange', 'red', 'purple'][floodLevels.indexOf(floodLevel)]}, 'Flooded Points at ' + floodLevel + 'm');
}

// Iterate over different flood levels and display the impact
floodLevels.forEach(displayFloodImpact);

// Visualize all building points, represented in yellow
///mapPanel_tsunami.addLayer(csv, {color: 'yellow'}, 'All Buildings');

// Add a title
///mapPanel_tsunami.add(ui.Label('Simulation of tsunami inundation on buildings', {position: 'top-left', fontWeight: 'bold', fontSize: '24px'}));

// Create a panel to display layer legend information
var legend = ui.Panel({
    style: {
        position: 'bottom-left',
        padding: '8px 15px'
    }
});

// Add a title for the layer legend
var legendTitle = ui.Label({
    value: 'Layer Description',
    style: {
        fontWeight: 'bold',
        fontSize: '18px',
        margin: '0 0 4px 0',
        padding: '0'
    }
});
legend.add(legendTitle);

var layers = [
    {name: 'Flooded buildings at 1m', color: 'blue'},
    {name: 'Flooded buildings at 3m', color: 'green'},
    {name: 'Flooded buildings at 5m', color: 'yellow'},
    {name: 'Flooded buildings at 7m', color: 'orange'},
    {name: 'Flooded buildings at 9m', color: 'red'},
    {name: 'Flooded buildings at 11m', color: 'purple'}
];

layers.forEach(function(layer) {
    // Create a panel with horizontal layout
    var layerItem = ui.Panel({
        widgets: [
            ui.Label({
                value: '■', // Use a square symbol to represent the color block
                style: {
                    color: layer.color, // Set the color of the block
                    fontWeight: 'bold',
                    fontSize: '18px', // Adjust the size to fit
                    margin: '0 4px 0 0' // Right margin to separate the color block and text
                }
            }),
            ui.Label({
                value: layer.name,
                style: {
                    color: 'black', // Text color
                    margin: '0',
                    fontSize: '16px' // Text size
                }
            })
        ],
        layout: ui.Panel.Layout.flow('horizontal')
    });
    // Add the legend for each layer to the legend panel
    legend.add(layerItem);
});

// Add the legend panel to the map
//mapPanel_tsunami.add(legend);








// ----------BUTTON FUNCTION------------------------------------------------------------------------------------------------------------------------------------------
function updateLayer() {
  var selectedLayer = layerSelect.getValue();

  if (selectedLayer === 'DAMAGED BUILDING') {
    showDamageLayer();
  } else if (selectedLayer === 'LANDSLIDE') {
    showLandslideLayer();
  } else if (selectedLayer === 'FIRE') {
    showFireLayer();
  } else if (selectedLayer === 'TSUNAMI') {
    showTsunamiLayer();
  }
}


function showDamageLayer() {
  removeLandslideLayer(); 
  removeFirelideLayer(); 
  removeTsunamiLayer();
 
  ui.root.add(mapPanel_building);
  
  var image = home()
  drawingTools.onDraw(footprints);
  
  mapPanel_building.add(buttonPanel); 
}


function showLandslideLayer() {
  removeDamageLayer();
  removeFirelideLayer();
  removeTsunamiLayer();
  
  ui.root.add(panel);
  ui.root.add(mapPanel);
  
  mapPanel.addLayer(meanDiff.clip(aoi), visParamsOriginal, 'Landslide Detection');
  mapPanel.addLayer(maskedDiff.clip(aoi), visParamsMasked, 'Masked Landslide Detection');
  mapPanel.setCenter(center.lon, center.lat, center.zoom);
  mapPanel.add(buttonPanel);
  
}


function showFireLayer() {
  removeDamageLayer();
  removeLandslideLayer(); 
  removeTsunamiLayer();
  
  ui.root.add(panel_fire);
  ui.root.add(mapPanel_fire);
  updateMap();
  //mapPanel_fire.add(buttonPanel);
}


function showTsunamiLayer() {
  removeDamageLayer();
  removeLandslideLayer();
  removeFirelideLayer();
  

  ui.root.add(mapPanel_tsunami);
  
  previousFlooded = ee.Image.constant(0);
  floodLevels.forEach(displayFloodImpact);
  
  mapPanel_tsunami.add(ui.Label('Simulation of tsunami inundation on buildings', {position: 'top-left', fontWeight: 'bold', fontSize: '24px'}));
  mapPanel_tsunami.add(legend);
  mapPanel_tsunami.add(buttonPanel);
}




function removeDamageLayer() {
  mapPanel_building.clear();
  ui.root.clear();
}

function removeLandslideLayer() {
  mapPanel.clear();
  ui.root.clear();
}

function removeFirelideLayer() {
  mapPanel_fire.clear();
  ui.root.clear();
}

function removeTsunamiLayer() {
  mapPanel_tsunami.clear();
  ui.root.clear();
 }