const check_field = async ($) => {
//   const $ = cheerio.load(html);
  var publisher = $("#gsc_oci_table > div:nth-child(7) > div.gsc_oci_value").text();
  var no = $("#gsc_oci_table > div:nth-child(5) > div.gsc_oci_value").text();
  var volume = $("#gsc_oci_table > div:nth-child(4) > div.gsc_oci_value").text();
  var academicJournal = $("#gsc_oci_table > div:nth-child(3) > div.gsc_oci_value").text()

  if (publisher.length >= 59) {
    var publisher = "";
  }
  if (academicJournal.length >= 110) {
    var academicJournal = "";
  }
  if (no.includes("-")) {
    var no = "";
    var page = $("#gsc_oci_table > div:nth-child(5) > div.gsc_oci_value").text();
    var publisher = $("#gsc_oci_table > div:nth-child(6) > div.gsc_oci_value").text();
  } else {
    var page = $("#gsc_oci_table > div:nth-child(6) > div.gsc_oci_value").text();
  }
  if (volume.includes("-")) {
    //Information-based
    //https://scholar.google.com/citations?view_op=view_citation&hl=th&oe=CP874&user=5OhyuzYAAAAJ&citation_for_view=5OhyuzYAAAAJ:9yKSN-GCB0IC

    var volume = "";
    var no = "";
    var page = $("#gsc_oci_table > div:nth-child(4) > div.gsc_oci_value").text();
    var publisher = $("#gsc_oci_table > div:nth-child(5) > div.gsc_oci_value").text();
  }
  if (volume.length >= 15) {
    var volume = "";
    var page = "";
    var publisher = "";
  }
  if (page.length >= 10) {
    var page = "";
    var publisher = "";
  }

  const data = {
    academicJournal:academicJournal,
    volume: volume,
    no: no,
    page: page,
    publisher: publisher
  }
  return data
};

module.exports = {
    check_field
};
  
