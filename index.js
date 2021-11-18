const core = require('@actions/core');
const fetch = require('node-fetch');

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
  const requestParams = {
    headers: {
      'Authorization': `Basic ${basicAuthString}`
    }
  }
  const endpoint = url + 'api/json'
  const response = await fetch(endpoint, requestParams);

  if (response.ok) {
    const res = response.json();
    const buildUrl = res.executable.url;
    return buildUrl;
  }
  else {
    await Promise.reject(response.error());
  }
}

async function enqueueJob(jobName, params = {}) {
  const jenkinsEndpoint = core.getInput('url');
  const url = `${jenkinsEndpoint}/job/${jobName}/buildWithParameters`;
  const reqParams = {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuthString}`
    },
    body: params,
  }

  const response = await fetch(url, reqParams);

  if (response.ok) {
    const queueUrl = response.headers.Location;
    return queueUrl;
  }
  else {
    await Promise.reject(response.error());
  }
}


async function waitJenkinsJob(jobName, timestamp) {
  core.info(`>>> Waiting for "${jobName}" ...`);
  while (true) {
    let data = await getJobStatus(jobName);
    if (data.timestamp < timestamp) {
      core.info(`>>> Job is not started yet... Wait 5 seconds more...`)
    } else if (data.result == "SUCCESS") {
      core.info(`>>> Job "${data.fullDisplayName}" successfully completed!`);
      break;
    } else if (data.result == "FAILURE" || data.result == "ABORTED") {
      throw new Error(`Failed job ${data.fullDisplayName}`);
    } else {
      core.info(`>>> Current Duration: ${data.duration}. Expected: ${data.estimatedDuration}`);
    }
    await sleep(5); // API call interval
  }
}

async function main() {
  try {
    let params = {};
    const startTs = + new Date();
    const jobName = core.getInput('job_name');
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
