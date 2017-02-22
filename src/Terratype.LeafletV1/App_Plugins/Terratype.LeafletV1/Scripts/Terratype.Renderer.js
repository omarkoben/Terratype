﻿(function (root) {
    var q = {
        poll: 100,
        maps: [],
        controlPosition: function (i) {
            switch (parseInt(i)) {
                case 1:
                    return 'topleft';
                case 3:
                    return 'topright';
                case 10:
                    return 'bottomleft';
                case 12:
                    return 'bottomright';
            }
            return 'topleft';
        },
        init: function () {
            q.load();
            q.updateJs();   //  Can be changed for q.updateJquery(), if *all* DOM updates happen via jQuery (and obviously jQuery is loaded). Have switched off to stop erroneous bug reports
        },
        loadCss: function (css) {
            for (var c = 0; c != css.length; c++) {
                if (document.createStyleSheet) {
                    document.createStyleSheet(css[c]);
                } else {
                    var l = document.createElement('link');
                    l.rel = 'stylesheet';
                    l.type = 'text/css';
                    l.href = css[c];
                    l.media = 'screen';
                    document.getElementsByTagName('head')[0].appendChild(l);
                }
            }
        },
        updateJs: function () {
            //  Use standard JS to monitor page resizes, dom changes, scrolling
            var counter = 0;
            var mapsRunning = 0;
            var timer = setInterval(function () {
                if (counter == q.maps.length) {
                    if (mapsRunning == 0) {
                        //  There are no maps running
                        clearInterval(timer);
                    }
                    counter = 0;
                    mapsRunning = 0;
                }
                var m = q.maps[counter];
                if (m.status != -1 && m.positions.length != 0) {
                    mapsRunning++;
                    if (m.status == 0) {
                        q.render(m);
                    } else {
                        q.idle(m);
                    }
                }
                counter++;
            }, q.poll);
        },
        updateJquery: function () {
            //  Can only be used, if all DOM updates happen via jQuery.
            var counter = 0;
            var timer = setInterval(function () {
                if (counter == q.maps.length) {
                    clearInterval(timer);
                    jQuery(window).on('DOMContentLoaded load resize scroll touchend', function () {
                        counter = 0;
                        var timer2 = setInterval(function () {
                            if (counter == q.maps.length) {
                                clearInterval(timer2);
                            } else {
                                var m = q.maps[counter];
                                if (m.status > 0 && m.positions.length != 0) {
                                    q.idle(m);
                                }
                                counter++;
                            }
                        }, q.poll);
                    });
                } else {
                    var m = q.maps[counter];
                    if (m.status == 0 && m.positions.length != 0) {
                        q.render(m);
                    }
                    counter++;
                }
            }, q.poll);
        },
        getMap: function (mapId) {
            for (var i = 0; i != q.maps.length; i++) {
                if (q.maps[i].id == mapId) {
                    return q.maps[i];
                }
            }
            return null;
        },
        defaultProvider: {
            layers: [{
                maxZoom: 18,
                id: 'OpenStreetMap.Mapnik'
            }],
            zoomControl: {
                enable: true,
                position: 1
            }
        },
        mergeJson: function (a, b) {        //  Does not merge arrays
            var mergy = function (c) {
                var t = {};
                for (var k in c) {
                    if (typeof c[k] === 'object' && c[k].constructor.name !== "Array") {
                        t[k] = mergy(c[k]);
                    } else {
                        t[k] = c[k];
                    }
                }
                return t;
            }
            var r = (a) ? mergy(a) : {};
            if (b) {
                for (var k in b) {
                    if (r[k] && typeof r[k] === 'object' && r[k].constructor.name !== "Array") {
                        r[k] = q.mergeJson(r[k], b[k]);
                    } else {
                        r[k] = b[k];
                    }
                }
            }
            return r;
        },
        load: function () {
            var matches = document.getElementsByClassName('Terratype.LeafletV1');
            for (var i = 0; i != matches.length; i++) {
                if (i == 0) {
                    q.loadCss(JSON.parse(unescape(matches[i].getAttribute('data-css-files'))));
                }
                mapId = matches[i].getAttribute('data-map-id');
                id = matches[i].getAttribute('data-id');
                var model = JSON.parse(unescape(matches[i].getAttribute('data-leafletv1')));
                var datum = q.parse(model.position.datum);
                var latlng = new L.latLng(datum.latitude, datum.longitude);
                var m = q.getMap(mapId);
                if (m == null) {
                    var minZoom = null, maxZoom = null;
                    var layers = [];
                    for (var g = 0; g != model.provider.mapSources.length; g++) {
                        for (var j = 0; j != root.terratype.leaflet.tileServers.length; j++) {
                            for (var k = 0; k != root.terratype.leaflet.tileServers[j].tileServers.length; k++) {
                                var ts = root.terratype.leaflet.tileServers[j].tileServers[k];
                                if (ts.id == model.provider.mapSources[g].tileServer.id) {
                                    var options = JSON.parse(JSON.stringify(ts.options));
                                    options.minZoom = ts.minZoom;
                                    options.maxZoom = ts.maxZoom;
                                    options.attribution = ts.attribution,
                                    layers.push(L.tileLayer(ts.url, options));
                                    if (minZoom == null || ts.minZoom < minZoom) {
                                        minZoom = ts.minZoom;
                                    }
                                    if (maxZoom == null || ts.maxZoom > minZoom) {
                                        maxZoom = ts.maxZoom;
                                    }
                                }
                            }
                        }
                    }

                    m = {
                        id: mapId,
                        div: id,
                        zoom: model.zoom,
                        provider: q.mergeJson(q.defaultProvider, model.provider),
                        positions: [],
                        center: latlng,
                        divoldsize: 0,
                        status: 0,
                        visible: false,
                        minZoom: minZoom,
                        maxZoom: maxZoom,
                        layers: layers
                    };
                    matches[i].style.display = 'block';
                    q.maps.push(m);
                }
                if (model.icon && model.icon.url) {
                    m.positions.push({
                        id: id,
                        label: matches[i].getAttribute('data-label-id'),
                        latlng: latlng,
                        icon: L.icon({
                            iconUrl: q.configIconUrl(model.icon.url),
                            iconSize: [model.icon.size.width, model.icon.size.height],
                            iconAnchor: [q.getAnchorHorizontal(model.icon.anchor.horizontal, model.icon.size.width),
                                q.getAnchorVertical(model.icon.anchor.vertical, model.icon.size.height)]
                        })
                    });
                }
            }
        },
        render: function (m) {
            m.ignoreEvents = 0;
            m.gmap = L.map(document.getElementById(m.div), {
                center: m.center,
                zoom: m.zoom,
                minZoom: m.minZoom,
                maxZoom: m.maxZoom,
                layers: m.layers,
                scrollWheelZoom: false,
                attributionControl: false,
                zoomControl: false
            });
            m.zoomControl = null;
            if (m.provider.zoomControl.enable) {
                m.zoomControl = L.control.zoom({
                    position: q.controlPosition(m.provider.zoomControl.position)
                }).addTo(m.gmap);
            }

            with ({
                mm: m
            }) {
                mm.gmap.on('zoomend', function () {
                    if (mm.ignoreEvents > 0) {
                        return;
                    }
                    //q.closeInfoWindows(mm);
                    mm.zoom = mm.gmap.getZoom();
                });
                mm.gmap.on('load', function () {
                    if (mm.ignoreEvents > 0) {
                        return;
                    }
                    q.refresh(mm);
                    mm.status = 2;
                });
                mm.gmap.on('resize', function () {
                    if (mm.ignoreEvents > 0) {
                        return;
                    }
                    q.checkResize(mm);
                });
                //scope.gmarker.on('click', function () {
                //    if (mm.ignoreEvents > 0) {
                //        return;
                //    }
                //    q.closeInfoWindows(mm);
                //});
            }
            m.ginfos = [];
            m.gmarkers = [];
            m.cluster = L.markerClusterGroup();

            for (var p = 0; p != m.positions.length; p++) {
                var item = m.positions[p];
                m.gmarkers[p] = L.marker(item.latlng, {
                    draggable: true,
                    id: 'terratype_' + id + '_marker',
                    icon: item.icon
                }).addTo(m.gmap);
                m.ginfos[p] = null;
                if (item.label) {
                    var l = document.getElementById(item.label);
                    if (l) {
                        m.ginfos[p] = m.gmarkers[p].bindPopup(l.innerHTML);
                    }
                }
                m.cluster.addLayer(m.gmarkers[p]);
            }

            if (m.positions.length > 1) {
                m.gmap.addLayer(m.cluster);
            }
            m.status = 1;
        },
        closeInfoWindows: function (m) {
            m.gmap.closePopup();
        },
        checkResize: function (m) {
            if (!m.gmap.getBounds().contains(m.center)) {
                q.refresh(m);
            }
        },
        refresh: function (m) {
            m.ignoreEvents++;
            m.gmap.setZoom(m.zoom);
            q.closeInfoWindows(m);
            m.gmap.setView(m.center);
            m.gmap.invalidateSize();
            setTimeout(function () {
                m.ignoreEvents--;
            }, 1);
        },
        configIconUrl: function (url) {
            if (typeof (url) === 'undefined' || url == null) {
                return '';
            }
            if (url.indexOf('//') != -1) {
                //  Is an absolute address
                return url;
            }
            //  Must be a relative address
            if (url.substring(0, 1) != '/') {
                url = '/' + url;
            }

            return root.location.protocol + '//' + root.location.hostname + (root.location.port ? ':' + root.location.port : '') + url;
        },
        getAnchorHorizontal: function (text, width) {
            if (typeof text == 'string') {
                switch (text.charAt(0)) {
                    case 'l':
                    case 'L':
                        return 0;

                    case 'c':
                    case 'C':
                    case 'm':
                    case 'M':
                        return width / 2;

                    case 'r':
                    case 'R':
                        return width - 1;
                }
            }
            return Number(text);
        },
        getAnchorVertical: function (text, height) {
            if (typeof text == 'string') {
                switch (text.charAt(0)) {
                    case 't':
                    case 'T':
                        return 0;

                    case 'c':
                    case 'C':
                    case 'm':
                    case 'M':
                        return height / 2;

                    case 'b':
                    case 'B':
                        return height - 1;
                }
            }
            return Number(text);
        },
        parse: function (text) {
            var args = text.trim().split(',');
            if (args.length < 2) {
                return false;
            }
            var lat = parseFloat(args[0].substring(0, 10));
            if (isNaN(lat) || lat > 90 || lat < -90) {
                return false;
            }
            var lng = parseFloat(args[1].substring(0, 10));
            if (isNaN(lng) || lng > 180 || lng < -180) {
                return false;
            }
            return {
                latitude: lat,
                longitude: lng
            };
        },
        isElementInViewport: function (el) {
            var rect = el.getBoundingClientRect();

            return (
                rect.bottom >= 0 &&
                rect.right >= 0 &&
                rect.top <= (window.innerHeight || document.documentElement.clientHeight) &&
                rect.left <= (window.innerWidth || document.documentElement.clientWidth)
            );
        },
        idle: function (m) {
            var element = document.getElementById(m.div);
            var newValue = element.parentElement.offsetTop;
            var newSize = element.clientHeight * element.clientWidth;
            var show = !(element.style.display && typeof element.style.display == 'string' && element.style.display.toLowerCase() == 'none');
            var visible = show && q.isElementInViewport(element);
            if (newValue != 0 && show == false) {
                //console.log('A ' + m.id + ': in viewport = ' + visible + ', showing = ' + show);
                //  Was hidden, now being shown
                document.getElementById(m.div).style.display = 'block';
            } else if (newValue == 0 && show == true) {
                //console.log('B ' + m.id + ': in viewport = ' + visible + ', showing = ' + show);
                //  Was shown, now being hidden
                document.getElementById(m.div).style.display = 'none';
                m.visible = false;
            }
            else if (visible == true && m.divoldsize != 0 && newSize != 0 && m.divoldsize != newSize) {
                //console.log('C ' + m.id + ': in viewport = ' + visible + ', showing = ' + show);
                //  showing, just been resized and map is visible
                q.refresh(m);
                m.visible = true;
            } else if (visible == true && m.visible == false) {
                //console.log('D ' + m.id + ': in viewport = ' + visible + ', showing = ' + show);
                //  showing and map just turned visible
                q.refresh(m);
                m.visible = true;
            } else if (visible == false && m.visible == true) {
                //console.log('E ' + m.id + ': in viewport = ' + visible + ', showing = ' + show);
                //  was visible, but now hiding
                m.visible = false;
            }
            m.divoldsize = newSize;
        }
    }

    var timer = setInterval(function () {
        if (L && L.MarkerClusterGroup && root.terratype && root.terratype.leaflet && root.terratype.leaflet.tileServers) {
            clearInterval(timer);
            q.init();
        }
    }, 100);

}(window));


