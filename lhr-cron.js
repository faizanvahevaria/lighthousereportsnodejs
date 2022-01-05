const fs = require('fs');
const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');

const mysql = require('mysql');
const util = require('util');

const db_connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'rv',
  database: 'ray_lhr'
});

const query = util.promisify(db_connection.query).bind(db_connection);

const publicDomainUrl = 'http://129.154.230.193/'
const publicHtmlPath = 'reports/';
const lhrDevice = 'desktop';


(async () => {
  let currentLhrWebsite;
  
  db_connection.connect((err) => {
    if (err) throw err;
    console.log('Connected to MySQL Server!');
  });
  
  try {
    let lhrStatusColumn = lhrDevice + '_lhr_check';
    const rows = await query('SELECT * FROM lhr_reports_company_list WHERE ??=0 LIMIT 1', [lhrStatusColumn]);
    currentLhrWebsite = rows[0];
    // console.log(currentLhrWebsite);
  } finally {
    // db_connection.end();
  }

  const chrome = await chromeLauncher.launch({chromeFlags: ['--headless']});
  const options = {output: ['html', 'json', 'csv'], port: chrome.port, emulatedFormFactor: lhrDevice};
  const runnerResult = await lighthouse(currentLhrWebsite.website_url, options);

  // `.report` is the HTML report as a string
  const lhrReportsObj = runnerResult.report;
  let lhrHtmlReportFileName = publicHtmlPath + currentLhrWebsite.co_id + ' ' + lhrDevice + ' ' + currentLhrWebsite.company_name + '.html';
  let lhrJsonReportFileName = publicHtmlPath + currentLhrWebsite.co_id + ' ' + lhrDevice + ' ' + currentLhrWebsite.company_name + '.json';
  let lhrCsvReportFileName  = publicHtmlPath + currentLhrWebsite.co_id + ' ' + lhrDevice + ' ' + currentLhrWebsite.company_name + '.csv';
  fs.writeFileSync(lhrHtmlReportFileName, lhrReportsObj[0]);
  fs.writeFileSync(lhrJsonReportFileName, lhrReportsObj[1]);
  fs.writeFileSync(lhrCsvReportFileName, lhrReportsObj[2]);

  let lhrHtmlReportFileNamePublic = publicDomainUrl + lhrHtmlReportFileName;
  let lhrJsonReportFileNamePublic = publicDomainUrl + lhrJsonReportFileName;
  let lhrCsvReportFileNamePublic  = publicDomainUrl + lhrCsvReportFileName;


  // `.lhr` is the Lighthouse Result as a JS object
  let company_id = currentLhrWebsite.co_id;
  let lhrPerformance = runnerResult.lhr.categories.performance.score * 100;
  let lhrPWA = runnerResult.lhr.categories.pwa.score * 100;
  let lhrAccessibility = runnerResult.lhr.categories.accessibility.score * 100;
  let lhrBestPractices = runnerResult.lhr.categories['best-practices'].score * 100;
  let lhrSEO = runnerResult.lhr.categories.seo.score * 100;

  console.log('Report is done for', runnerResult.lhr.finalUrl);
  console.log('Performance score was', lhrPerformance);
  console.log('PWA score was', lhrPWA);
  console.log('Accessibility score was', lhrAccessibility);
  console.log('Best Practices score was', lhrBestPractices);
  console.log('SEO score was', lhrSEO);


  
  try {
    
    let sqlQueryStr = `UPDATE lhr_reports_company_list
      SET desktop_lhr_check =?,
      d_performance =?,
      d_pwa =?,
      d_accessibility =?,
      d_best_practices =?,
      d_seo =?,
      d_lhr_html =?,
      d_lhr_json =?,
      d_lhr_csv =?
      WHERE co_id=?
    `;

    let sqlQueryArgs = [
      1,
      lhrPerformance,
      lhrPWA,
      lhrAccessibility,
      lhrBestPractices,
      lhrSEO,
      lhrHtmlReportFileNamePublic,
      lhrJsonReportFileNamePublic,
      lhrCsvReportFileNamePublic,
      company_id
    ];


    const rows = await query(sqlQueryStr, sqlQueryArgs);
    // console.log(currentLhrWebsite);
  } finally {
    db_connection.end();
  }

  await chrome.kill();
})();