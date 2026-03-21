(function () {
  "use strict";

  var container = document.getElementById("edd-delivery-estimate");
  if (!container) return;

  var shop = container.dataset.shop;
  var country = container.dataset.country || "US";
  var heading = container.dataset.heading || "Estimated Delivery";
  var showCarrier = container.dataset.showCarrier === "true";
  var dateFormat = container.dataset.dateFormat || "long";

  var appUrl = container.dataset.appUrl || window.Shopify?.routes?.root || "/";
  var estimateUrl =
    appUrl.replace(/\/$/, "") +
    "/apps/delivery-estimate?shop=" +
    encodeURIComponent(shop) +
    "&country=" +
    encodeURIComponent(country);

  fetch(estimateUrl)
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(function (data) {
      var html = '<div class="edd-heading">' + escapeHtml(heading) + "</div>";

      if (data.confidence === "exact") {
        html +=
          '<div class="edd-date">Arrives by ' +
          formatDate(data.estimatedDate, dateFormat) +
          "</div>";
      } else {
        html +=
          '<div class="edd-date">' +
          formatDate(data.rangeStart, dateFormat) +
          " – " +
          formatDate(data.rangeEnd, dateFormat) +
          "</div>";
      }

      if (showCarrier && data.carrier) {
        html +=
          '<div class="edd-carrier">via ' +
          escapeHtml(formatCarrier(data.carrier)) +
          "</div>";
      }

      container.innerHTML = html;
    })
    .catch(function () {
      container.innerHTML =
        '<div class="edd-error" style="display:block">Delivery estimate unavailable</div>';
    });

  function formatDate(dateStr, fmt) {
    var d = new Date(dateStr + "T00:00:00");
    if (fmt === "short") {
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
})();
