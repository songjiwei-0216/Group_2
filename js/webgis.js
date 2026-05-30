/* ===== GIS Lab 5 - WebGIS with OpenLayers ===== */

// --- Basemaps ---
const osmLayer = new ol.layer.Tile({
    title: 'OpenStreetMap',
    type: 'base',
    visible: true,
    source: new ol.source.OSM()
});

const cartoLayer = new ol.layer.Tile({
    title: 'CartoDB Positron',
    type: 'base',
    visible: false,
    source: new ol.source.XYZ({
        url: 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        attributions: '&copy; <a href="https://carto.com/">CARTO</a>, &copy; <a href="https://openstreetmap.org/copyright">OSM</a>'
    })
});

const satelliteLayer = new ol.layer.Tile({
    title: 'Satellite',
    type: 'base',
    visible: false,
    source: new ol.source.XYZ({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attributions: '&copy; Esri, Maxar, Earthstar Geographics'
    })
});

// --- Style Functions ---

// Province boundaries style
const provinceStyle = new ol.style.Style({
    stroke: new ol.style.Stroke({
        color: '#2d3436',
        width: 1.5
    }),
    fill: new ol.style.Fill({
        color: 'rgba(44,110,73,0.08)'
    })
});

const provinceHighlightStyle = new ol.style.Style({
    stroke: new ol.style.Stroke({
        color: '#f8c630',
        width: 3
    }),
    fill: new ol.style.Fill({
        color: 'rgba(248,198,48,0.15)'
    })
});

// Bivariate color mapping
const BIV_COLORS = {
    11: '#e8e8e8', 12: '#b0d0b0', 13: '#73b873', 14: '#2d9e2d',
    21: '#f0b0b0', 22: '#c8a0a0', 23: '#9a8a6a', 24: '#607040',
    31: '#e88888', 32: '#c07050', 33: '#a05830'
};

function bivariateStyleFunction(feature) {
    const biv = feature.get('bivariate');
    const color = BIV_COLORS[biv] || '#cccccc';
    return new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: '#ffffff',
            width: 1
        }),
        fill: new ol.style.Fill({
            color: color
        })
    });
}

// Make bivariate layer semi-transparent when dissolved zones are visible
function updateBivariateOpacity(dissolvedVisible) {
    if (dissolvedVisible) {
        bivariateLayer.setStyle(function(feature) {
            const biv = feature.get('bivariate');
            const color = BIV_COLORS[biv] || '#cccccc';
            return new ol.style.Style({
                stroke: new ol.style.Stroke({ color: '#ffffff', width: 1 }),
                fill: new ol.style.Fill({ color: color, opacity: 0.6 })
            });
        });
    } else {
        bivariateLayer.setStyle(bivariateStyleFunction);
    }
}

// Pollution class colors (EU standards) - higher contrast
const POL_COLORS = {
    1: '#006400',   // dark green for class 1 (≤10)
    2: '#FF8C00'    // dark orange for class 2 (10-25)
};

function polStyleFunction(feature) {
    const cls = Number(feature.get('pol_class_max'));
    const color = POL_COLORS[cls] || '#cccccc';
    return new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: '#000000',
            width: 2
        }),
        fill: new ol.style.Fill({
            color: color
        })
    });
}

// --- Vector Layers (load from embedded data.js) ---
const bivariateLayer = new ol.layer.VectorImage({
    title: 'NO2-Population Bivariate',
    visible: true,
    source: new ol.source.Vector({
        features: new ol.format.GeoJSON().readFeatures(GEOJSON_NETHERLANDS_BIVARIATE, {
            featureProjection: 'EPSG:3857'
        })
    }),
    style: bivariateStyleFunction
});

const provinceLayer = new ol.layer.VectorImage({
    title: 'Province Boundaries',
    visible: true,
    source: new ol.source.Vector({
        features: new ol.format.GeoJSON().readFeatures(GEOJSON_NETHERLANDS_PROVINCES, {
            featureProjection: 'EPSG:3857'
        })
    }),
    style: provinceStyle
});

const dissolvedLayer = new ol.layer.Vector({
    title: 'NO2 Dissolved Zones',
    visible: true,
    source: new ol.source.Vector({
        features: new ol.format.GeoJSON().readFeatures(GEOJSON_CHART, {
            featureProjection: 'EPSG:3857'
        })
    }),
    style: polStyleFunction,
    zIndex: 5
});

// --- Map ---
const map = new ol.Map({
    target: 'map',
    layers: [osmLayer, cartoLayer, satelliteLayer, bivariateLayer, provinceLayer, dissolvedLayer],
    view: new ol.View({
        center: ol.proj.fromLonLat([5.5, 52.2]),
        zoom: 8,
        minZoom: 6,
        maxZoom: 18
    }),
    controls: [
        new ol.control.ScaleLine({ units: 'metric' }),
        new ol.control.FullScreen(),
        new ol.control.MousePosition({
            coordinateFormat: function(coords) {
                const lonLat = ol.proj.toLonLat(coords);
                return 'Lon: ' + lonLat[0].toFixed(4) + '&deg; | Lat: ' + lonLat[1].toFixed(4) + '&deg;';
            },
            projection: 'EPSG:4326',
            className: 'custom-mouse-position'
        }),
        new ol.control.Zoom(),
        new ol.control.Attribution({ collapsible: true })
    ]
});

// --- Basemap Switcher ---
function setBaseLayer(name) {
    [osmLayer, cartoLayer, satelliteLayer].forEach(function(layer) {
        layer.setVisible(layer.get('title') === name);
    });
}

// --- Layer Visibility Toggles ---
function toggleLayer(name, visible) {
    [bivariateLayer, provinceLayer, dissolvedLayer].forEach(function(layer) {
        if (layer.get('title') === name) {
            layer.setVisible(visible);
        }
    });
    // When dissolved zones toggle, adjust bivariate opacity
    if (name === 'NO2 Dissolved Zones') {
        updateBivariateOpacity(visible);
    }
}

// --- Interaction: Highlight province on hover ---
const highlightOverlay = new ol.layer.Vector({
    source: new ol.source.Vector(),
    style: provinceHighlightStyle,
    zIndex: 10
});
map.addLayer(highlightOverlay);

let highlightFeature = null;

map.on('pointermove', function(evt) {
    const feature = map.forEachFeatureAtPixel(evt.pixel, function(f) {
        return f;
    });

    if (feature !== highlightFeature) {
        highlightFeature = feature;
        highlightOverlay.getSource().clear();
        if (feature) {
            highlightOverlay.getSource().addFeature(feature.clone());
        }
        map.getTargetElement().style.cursor = feature ? 'pointer' : '';
    }
});

// --- Popup ---
const popupContainer = document.getElementById('popup') || (function() {
    const el = document.createElement('div');
    el.id = 'popup';
    el.className = 'ol-popup';
    el.innerHTML = '<a href="#" id="popup-closer" class="ol-popup-closer"></a><div id="popup-content"></div>';
    document.body.appendChild(el);
    return el;
})();

const popupContent = document.getElementById('popup-content');
const popupCloser = document.getElementById('popup-closer');

const popupOverlay = new ol.Overlay({
    element: popupContainer,
    positioning: 'bottom-center',
    stopEvent: false,
    offset: [0, -10]
});
map.addOverlay(popupOverlay);

popupCloser.addEventListener('click', function(e) {
    e.preventDefault();
    popupOverlay.setPosition(undefined);
    popupCloser.blur();
    return false;
});

// Style the popup
popupContainer.style.cssText = 'background:white;border-radius:8px;padding:12px 16px;box-shadow:0 2px 15px rgba(0,0,0,0.2);font-size:13px;max-width:280px;';
popupCloser.style.cssText = 'text-decoration:none;position:absolute;top:4px;right:8px;font-size:16px;color:#999;';

map.on('singleclick', function(evt) {
    const feature = map.forEachFeatureAtPixel(evt.pixel, function(f) {
        return f;
    });

    if (feature) {
        const props = feature.getProperties();
        let html = '<table style="width:100%;border-collapse:collapse;">';
        for (const key in props) {
            if (key === 'geometry') continue;
            let val = props[key];
            if (val === null || val === undefined) val = '';
            if (typeof val === 'number') val = val.toFixed(2);
            html += '<tr><td style="padding:2px 6px;font-weight:600;color:#2d6e49;">' + key + '</td><td style="padding:2px 6px;">' + val + '</td></tr>';
        }
        html += '</table>';
        popupContent.innerHTML = html;
        popupOverlay.setPosition(evt.coordinate);
    } else {
        popupOverlay.setPosition(undefined);
    }
});

// --- Legend ---
function buildLegend() {
    const bivLegend = document.getElementById('biv-legend-content');
    if (bivLegend) {
        let html = '<div class="biv-legend">';
        // Header row
        html += '<div></div>';
        html += '<div class="cell" style="font-size:0.6rem;color:#888;">Pop1</div>';
        html += '<div class="cell" style="font-size:0.6rem;color:#888;">Pop2</div>';
        html += '<div class="cell" style="font-size:0.6rem;color:#888;">Pop3</div>';
        html += '<div class="cell" style="font-size:0.6rem;color:#888;">Pop4</div>';

        for (let pol = 1; pol <= 3; pol++) {
            html += '<div class="cell" style="font-size:0.6rem;color:#888;">Pol' + pol + '</div>';
            for (let pop = 1; pop <= 4; pop++) {
                const biv = pol * 10 + pop;
                const color = BIV_COLORS[biv] || '#ccc';
                html += '<div class="cell" style="background:' + color + ';">' + biv + '</div>';
            }
        }
        html += '</div>';
        html += '<div style="font-size:0.7rem;color:#888;margin-top:4px;">';
        html += '<span style="display:inline-block;margin-right:12px;">Pol = NO&#8322; Class</span>';
        html += '<span>Pop = Population Class</span>';
        html += '</div>';
        bivLegend.innerHTML = html;
    }

    const polLegend = document.getElementById('pol-legend-content');
    if (polLegend) {
        polLegend.innerHTML =
            '<div class="legend-item"><span class="legend-color" style="background:#2d9e2d;"></span> Class 1 (&le;10 &mu;g/m&sup3;)</div>' +
            '<div class="legend-item"><span class="legend-color" style="background:#f8c630;"></span> Class 2 (10-25 &mu;g/m&sup3;)</div>';
    }
}

// Initialize legend on load
document.addEventListener('DOMContentLoaded', buildLegend);
