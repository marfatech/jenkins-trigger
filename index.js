const core = require('@actions/core');
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

// create auth token for Jenkins API
const basicAuthString = Buffer.from(`${core.getInput('user_name')}:${core.getInput('api_token')}`).toString('base64');

let timer = setTimeout(() => {
  core.setFailed("Job Timeout");
  core.error("Exception Error: Timed out");
  }, (Number(core.getInput('timeout')) * 1000));

const sleep = (seconds) => {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, (seconds * 1000));
  });
};

async function getBuildUrl(url = '') {
  const endpoint = url + 'api/json'
  let xhr = new XMLHttpRequest();
  xhr.open('GET', endpoint, false);
  xhr.setRequestHeader(`'Authorization', 'Basic ${basicAuthString}'`);
  xhr.send();
  xhr.responseType = 'json';

  if (xhr.status === 200) {
    const res = xhr.response;
    const buildUrl = res.executable.url;
    return buildUrl;
  }
  else {
    await Promise.reject('1');
  }
}

async function enqueueJob(jobName, params = {}) {
  const jenkinsEndpoint = core.getInput('url');
  const url = `${jenkinsEndpoint}/job/${jobName}/buildWithParameters`;

  let xhr = new XMLHttpRequest();

  xhr.open('POST', url, false);
  xhr.setRequestHeader(`'Authorization', 'Basic ${basicAuthString}'`);
  xhr.send();

  if (xhr.status === 201) {
    const queueUrl = xhr.getResponseHeader('Location');
    return queueUrl;
  }
  else {
    await Promise.reject('2');
  }
}

async function main() {
  try {
    let params = {};
    const startTs = + new Date();
    const jobName = core.getInput('job_name');
    core.debug(core.getInput('parameter'));
    core.debug(JSON.parse(core.getInput('parameter')));
    if (core.getInput('parameter')) {
      params = JSON.parse(core.getInput('parameter'));
      core.info(`>>> Parameter ${params.toString()}`);
    }
    // POST API call
    const queuedUrl = await enqueueJob(jobName, params);
    core.info(1);
    core.info(queuedUrl);
    const buildUrl = await getBuildUrl(queuedUrl)
    core.info(2);
    core.info(queuedUrl);

    // Waiting for job completion
    // if (core.getInput('wait') == 'true') {
    //   await waitJenkinsJob(jobName, startTs);
    // }
  } catch (err) {
    core.setFailed(err.message);
    core.error(err.message);
  } finally {
    clearTimeout(timer);
  }
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED="0";
main();
