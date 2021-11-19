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

async function checkBuildStatus(buildUrl) {
  const getBuildRequest = (path) => {
    let xhr = new XMLHttpRequest();
    xhr.open('GET', path, false);
    xhr.setRequestHeader('Authorization', `Basic ${basicAuthString}`);
    xhr.send();
    return xhr;
  }

  const endpoint = buildUrl + 'api/json'

  let xhr = getBuildRequest(endpoint)
  let building = true;
  while (xhr.status === 200) {
    const res = JSON.parse(xhr.responseText);
    building = res.building
    core.info('Build in progress...')
    if (!building) {
      if (res.result === 'SUCCESS') {
        return true
      }
      else {
        await Promise.reject('Build status: ' + res.result)
      }
    }

    await sleep(20);
    xhr = getBuildRequest(endpoint)
  }
}

async function getBuildUrl(url = '') {
  const getQueueItemRequest = (path) => {
    let xhr = new XMLHttpRequest();
    xhr.open('GET', path, false);
    xhr.setRequestHeader('Authorization', `Basic ${basicAuthString}`);
    xhr.send();
    return xhr;
  }

  let endpoint = url + 'api/json'
  core.info(endpoint)
  let xhr = getQueueItemRequest(endpoint)
  if (xhr.status === 301) {
    const redirectTo = xhr.getResponseHeader('location')
    endpoint = redirectTo
    xhr = getQueueItemRequest(endpoint)
  }

  while (xhr.status === 200) {
    const res = JSON.parse(xhr.responseText);

    if (res['_class'] === 'hudson.model.Queue$WaitingItem' ||
        res['_class'] === 'hudson.model.Queue$BuildableItem') {
      core.info('Build in queue')
      await sleep(10);
      xhr = getQueueItemRequest(endpoint)
    }
    else if (res['_class'] === 'hudson.model.Queue$LeftItem') {
      const buildUrl = res['executable'].url;
      core.info('Build started: ' + buildUrl)
      return buildUrl;
    }
    else {
      core.info('Unknown item status')
      core.info(xhr.responseText)
      await Promise.reject('Unknown item status');
    }
  }
}

async function enqueueJob(jobName, params = {}) {
  const jenkinsEndpoint = core.getInput('url');
  const url = `${jenkinsEndpoint}/job/${jobName}/buildWithParameters`;

  const postParams = new URLSearchParams(params);

  let xhr = new XMLHttpRequest();
  xhr.open('POST', url, false);
  xhr.setRequestHeader('Authorization', `Basic ${basicAuthString}`);
  xhr.send(JSON.stringify(params));

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
    }

    const queuedUrl = await enqueueJob(jobName, params);

    const buildUrl = await getBuildUrl(queuedUrl)

    if (core.getInput('wait') === 'true') {
      await checkBuildStatus(buildUrl);

    }
  } catch (err) {
    core.setFailed(err.message);
    core.error(err.message);
  } finally {
    clearTimeout(timer);
  }
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED="0";
main();
