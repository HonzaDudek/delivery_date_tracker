(function () {
  "use strict";

  var container = document.getElementById("edd-delivery-estimate");
  if (!container) return;

  var shop = container.dataset.shop;
  var country = container.dataset.country || "US";
  var productId = container.dataset.productId;
  var variantId = container.dataset.variantId;
  var heading = container.dataset.heading || "Estimated Delivery";
  var showCarrier = container.dataset.showCarrier === "true";
  var showIcon = container.dataset.showIcon === "true";
  var dateFormat = container.dataset.dateFormat || "long";
  var cacheTtl = parseInt(container.dataset.cacheTtl || "5", 10) * 60 * 1000;

  var cacheKey =
    "edd_" + shop + "_" + country + "_" + (productId || "") + "_" + (variantId || "");

  // Try cache first
  var cached = getCache(cacheKey);
  if (cached) {
    render(cached);
    return;
  }

  // Build estimate URL via app proxy
  var appUrl =
    container.dataset.appUrl || window.Shopify?.routes?.root || "/";
  var estimateUrl =
    appUrl.replace(/\/$/, "") +
    "/apps/delivery-estimate?shop=" +
    encodeURIComponent(shop) +
    "&country=" +
    encodeURIComponent(country);

  if (productId) {
    estimateUrl += "&productId=" + encodeURIComponent(productId);
  }
  if (variantId) {
    estimateUrl += "&variantId=" + encodeURIComponent(variantId);
  }

  fetch(estimateUrl)
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(function (data) {
      setCache(cacheKey, data, cacheTtl);
      render(data);
    })
    .catch(function () {
      container.innerHTML =
        '<div class="edd-error" style="display:block">Delivery estimate unavailable</div>';
    });

  // Re-fetch when variant changes (e.g. customer picks different size/color)
  document.addEventListener("variant:changed", function (e) {
    var newVariantId = e.detail && e.detail.variant && e.detail.variant.id;
    if (newVariantId && String(newVariantId) !== variantId) {
      variantId = String(newVariantId);
      container.dataset.variantId = variantId;
      var newCacheKey =
        "edd_" + shop + "_" + country + "_" + (productId || "") + "_" + variantId;
      var newCached = getCache(newCacheKey);
      if (newCached) {
        render(newCached);
      } else {
        showLoading();
        var url =
          appUrl.replace(/\/$/, "") +
          "/apps/delivery-estimate?shop=" +
          encodeURIComponent(shop) +
          "&country=" +
          encodeURIComponent(country) +
          "&productId=" +
          encodeURIComponent(productId || "") +
          "&variantId=" +
          encodeURIComponent(variantId);
        fetch(url)
          .then(function (res) {
            if (!res.ok) throw new Error("HTTP " + res.status);
            return res.json();
          })
          .then(function (data) {
            setCache(newCacheKey, data, cacheTtl);
            render(data);
          })
          .catch(function () {
            container.innerHTML =
              '<div class="edd-error" style="display:block">Delivery estimate unavailable</div>';
          });
      }
    }
  });

  function render(data) {
    var html = "";

    if (showIcon) {
      html += '<span class="edd-icon" aria-hidden="true">&#x1F4E6;</span>';
    }

    html += '<span class="edd-heading">' + escapeHtml(heading) + ": </span>";

    if (data.confidence === "exact") {
      html +=
        '<span class="edd-date">Arrives by ' +
        formatDate(data.estimatedDate, dateFormat) +
        "</span>";
    } else {
      html +=
        '<span class="edd-date">' +
        formatDate(data.rangeStart, dateFormat) +
        " \u2013 " +
        formatDate(data.rangeEnd, dateFormat) +
        "</span>";
    }

    if (showCarrier && data.carrier) {
      html +=
        ' <span class="edd-carrier">via ' +
        escapeHtml(formatCarrier(data.carrier)) +
        "</span>";
    }

    container.innerHTML = html;
    container.setAttribute("aria-busy", "false");
  }

  function showLoading() {
    container.innerHTML =
      '<div class="edd-loading" aria-live="polite" aria-busy="true">' +
      '<span class="edd-spinner" aria-hidden="true"></span>' +
      "<span>Calculating...</span>" +
      "</div>";
  }

  function formatDate(dateStr, fmt) {
    var d = new Date(dateStr + "T00:00:00");
    if (fmt === "short") {
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
    if (fmt === "numeric") {
      return d.toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      });
    }
    return d.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatCarrier(carrier) {
    var names = {
      usps_priority: "USPS Priority Mail",
      usps_first_class: "USPS First Class",
      usps_express: "USPS Priority Mail Express",
      ups_ground: "UPS Ground",
      ups_2day: "UPS 2nd Day Air",
      ups_next_day: "UPS Next Day Air",
      fedex_ground: "FedEx Ground",
      fedex_express: "FedEx Express",
      fedex_2day: "FedEx 2Day",
      dhl_express: "DHL Express",
    };
    return names[carrier] || carrier.replace(/_/g, " ").toUpperCase();
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // localStorage cache helpers
  function getCache(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var entry = JSON.parse(raw);
      if (Date.now() > entry.expires) {
        localStorage.removeItem(key);
        return null;
      }
      return entry.data;
    } catch (e) {
      return null;
    }
  }

  function setCache(key, data, ttlMs) {
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ data: data, expires: Date.now() + ttlMs })
      );
    } catch (e) {
      // Storage full or unavailable — silently ignore
    }
  }
})();
