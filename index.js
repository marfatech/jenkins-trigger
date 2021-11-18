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
  core.info(endpoint)
  let xhr = new XMLHttpRequest();
  xhr.open('GET', endpoint, false);
  xhr.setRequestHeader('Authorization', `Basic ${basicAuthString}`);
  xhr.send();

  core.info(xhr.status)
  core.info(xhr.getAllResponseHeaders())

  if (xhr.status === 301) {
    const redirectTo = xhr.getResponseHeader('location')
    xhr = new XMLHttpRequest();
    xhr.open('GET', redirectTo, false);
    xhr.setRequestHeader('Authorization', `Basic ${basicAuthString}`);
    xhr.send();
  }

  core.info(xhr.responseText)
  core.info(xhr.status)
  core.info(xhr.getAllResponseHeaders())

  if (xhr.status === 200) {
    const res = xhr.response;
    core.info(res)
    const buildUrl = res.executable.url;
    core.info(buildUrl)
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
  xhr.setRequestHeader('Authorization', `Basic ${basicAuthString}`);
  xhr.send();

  if (xhr.status === 201) {
    const queueUrl = xhr.getResponseHeader('location')
    core.info("Enqueued job: " + queueUrl)
    return queueUrl;
  }
  else {
    await Promise.reject("Cannot start the job");
  }
}

async function main() {
  try {
    let params = {};
    const startTs = + new Date();
    const jobName = core.getInput('job_name');
    core.info(core.getInput('parameter').toString());
    core.info(JSON.parse(core.getInput('parameter')).ARAMUZ_BRANCH.toString());
    if (core.getInput('parameter')) {
      params = JSON.parse(core.getInput('parameter'));
      core.info(`>>> Parameter ${params.toString()}`);
    }

    const queuedUrl = await enqueueJob(jobName, params);

    sleep(10)
    const buildUrl = await getBuildUrl(queuedUrl)
    core.info(2);
    core.info(buildUrl);

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
