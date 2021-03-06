const bidfactory = require('src/bidfactory.js');
const bidmanager = require('src/bidmanager.js');
const utils = require('src/utils.js');
const adloader = require('src/adloader');
const adaptermanager = require('src/adaptermanager');

function WideOrbitAdapter() {
  const pageImpression = 'JSAdservingMP.ashx?pc={pc}&pbId={pbId}&clk=&exm=&jsv=1.0&tsv=1.0&cts={cts}&arp=0&fl=0&vitp=&vit=&jscb=window.$$PREBID_GLOBAL$$.handleWideOrbitCallback&url={referrer}&fp=&oid=&exr=&mraid=&apid=&apbndl=&mpp=0&uid=&cb={cb}&hb=1';
  const pageRepeatCommonParam = '&gid{o}={gid}&pp{o}=&clk{o}=&rpos{o}={rpos}&ecpm{o}={ecpm}&ntv{o}=&ntl{o}=&adsid{o}=';
  const pageRepeatParamId = '&pId{o}={pId}&rank{o}={rank}';
  const pageRepeatParamNamed = '&wsName{o}={wsName}&wName{o}={wName}&rank{o}={rank}&bfDim{o}={width}x{height}&subp{o}={subp}';
  const base = (window.location.protocol) + '//p{pbId}.atemda.com/';
  let bids;
  const adapterName = 'wideorbit';

  function _fixParamNames(param) {
    if (!param) {
      return;
    }

    const properties = ['site', 'page', 'width', 'height', 'rank', 'subPublisher', 'ecpm', 'atf', 'pId', 'pbId', 'referrer'];
    let prop;

    utils._each(properties, function (correctName) {
      for (prop in param) {
        if (param.hasOwnProperty(prop) && prop.toLowerCase() === correctName.toLowerCase()) {
          param[correctName] = param[prop];
          break;
        }
      }
    });
  }

  function _setParam(str, param, value) {
    var pattern = new RegExp('{' + param + '}', 'g');

    if (value === true) {
      value = 1;
    }
    if (value === false) {
      value = 0;
    }
    return str.replace(pattern, value);
  }

  function _setParams(str, keyValuePairs) {
    utils._each(keyValuePairs, function (keyValuePair) {
      str = _setParam(str, keyValuePair[0], keyValuePair[1]);
    });
    return str;
  }

  function _setCommonParams(pos, params) {
    return _setParams(pageRepeatCommonParam, [
      ['o', pos],
      ['gid', encodeURIComponent(params.tagId)],
      ['rpos', params.atf ? 1001 : 0],
      ['ecpm', params.ecpm || '']
    ]);
  }

  function _getRankParam(rank, pos) {
    return rank || pos;
  }

  function _setupIdPlacementParameters(pos, params) {
    return _setParams(pageRepeatParamId, [
      ['o', pos],
      ['pId', params.pId],
      ['rank', _getRankParam(params.rank, pos)]
    ]);
  }

  function _setupNamedPlacementParameters(pos, params) {
    return _setParams(pageRepeatParamNamed, [
      ['o', pos],
      ['wsName', encodeURIComponent(decodeURIComponent(params.site))],
      ['wName', encodeURIComponent(decodeURIComponent(params.page))],
      ['width', params.width],
      ['height', params.height],
      ['subp', params.subPublisher ? encodeURIComponent(decodeURIComponent(params.subPublisher)) : ''],
      ['rank', _getRankParam(params.rank, pos)]
    ]);
  }

  function _setupAdCall(publisherId, placementCount, placementsComponent, referrer) {
    return _setParams(base + pageImpression, [
      ['pbId', publisherId],
      ['pc', placementCount],
      ['cts', new Date().getTime()],
      ['cb', Math.floor(Math.random() * 100000000)],
      ['referrer', encodeURIComponent(referrer || '')]
    ]) + placementsComponent;
  }

  function _setupPlacementParameters(pos, params) {
    var commonParams = _setCommonParams(pos, params);

    if (params.pId) {
      return _setupIdPlacementParameters(pos, params) + commonParams;
    }

    return _setupNamedPlacementParameters(pos, params) + commonParams;
  }

  function _callBids(params) {
    let publisherId;
    let bidUrl = '';
    let i;
    let referrer;

    bids = params.bids || [];

    for (i = 0; i < bids.length; i++) {
      var requestParams = bids[i].params;

      requestParams.tagId = bids[i].placementCode;

      _fixParamNames(requestParams);

      publisherId = requestParams.pbId;
      referrer = referrer || requestParams.referrer;
      bidUrl += _setupPlacementParameters(i, requestParams);
    }

    bidUrl = _setupAdCall(publisherId, bids.length, bidUrl, referrer);

    utils.logMessage('Calling WO: ' + bidUrl);

    adloader.loadScript(bidUrl);
  }

  function _processUserMatchings(userMatchings) {
    const headElem = document.getElementsByTagName('head')[0];
    let createdElem;

    utils._each(userMatchings, function (userMatching) {
      createdElem = undefined;
      switch (userMatching.Type) {
        case 'redirect':
          createdElem = document.createElement('img');
          break;
        case 'iframe':
          createdElem = utils.createInvisibleIframe();
          break;
        case 'js':
          createdElem = document.createElement('script');
          createdElem.type = 'text/javascript';
          createdElem.async = true;
          break;
      }
      if (createdElem) {
        createdElem.src = decodeURIComponent(userMatching.Url);
        headElem.insertBefore(createdElem, headElem.firstChild);
      }
    });
  }

  function _getBidResponse(id, placements) {
    var i;

    for (i = 0; i < placements.length; i++) {
      if (placements[i].ExtPlacementId === id) {
        return placements[i];
      }
    }
  }

  function _isUrl(scr) {
    return scr.slice(0, 6) === 'http:/' || scr.slice(0, 7) === 'https:/' || scr.slice(0, 2) === '//';
  }

  function _buildAdCode(placement) {
    let adCode = placement.Source;
    let pixelTag;

    utils._each(placement.TrackingCodes, function (trackingCode) {
      if (_isUrl(trackingCode)) {
        pixelTag = '<img src="' + trackingCode + '" width="0" height="0" style="position:absolute"></img>';
      } else {
        pixelTag = trackingCode;
      }
      adCode = pixelTag + adCode;
    });

    return adCode;
  }

  window.$$PREBID_GLOBAL$$ = window.$$PREBID_GLOBAL$$ || {};
  window.$$PREBID_GLOBAL$$.handleWideOrbitCallback = function (response) {
    var bidResponse,
      bidObject;

    utils.logMessage('WO response. Placements: ' + response.Placements.length);

    _processUserMatchings(response.UserMatchings);

    utils._each(bids, function (bid) {
      bidResponse = _getBidResponse(bid.placementCode, response.Placements);

      if (bidResponse && bidResponse.Type === 'DirectHTML') {
        bidObject = bidfactory.createBid(1);
        bidObject.cpm = bidResponse.Bid;
        bidObject.ad = _buildAdCode(bidResponse);
        bidObject.width = bidResponse.Width;
        bidObject.height = bidResponse.Height;
      } else {
        bidObject = bidfactory.createBid(2);
      }

      bidObject.bidderCode = adapterName;
      bidmanager.addBidResponse(bid.placementCode, bidObject);
    });
  };

  return {
    callBids: _callBids
  };
}

adaptermanager.registerBidAdapter(new WideOrbitAdapter(), 'wideorbit');

module.exports = WideOrbitAdapter;
