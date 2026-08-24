import { mkdir, writeFile } from 'node:fs/promises';

const organization = 'gabrielhochmann-academic';
const token = process.env.PROFILE_STATS_TOKEN;

if (!token) {
  throw new Error('PROFILE_STATS_TOKEN is not available.');
}

const headers = {
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'X-GitHub-Api-Version': '2022-11-28',
};

async function getJson(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API request failed (HTTP ${response.status}).`);
  }
  return response.json();
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  })[character]);
}

function cardShell(title, content, height) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="380" height="${height}" viewBox="0 0 380 ${height}" role="img" aria-label="${escapeXml(title)}">
  <rect width="380" height="${height}" rx="8" fill="#0d1117"/>
  <text x="24" y="38" fill="#f4d03f" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="18" font-weight="600">${escapeXml(title)}</text>
  ${content}
</svg>`;
}

const repositories = await getJson(`https://api.github.com/orgs/${organization}/repos?type=all&per_page=100&sort=updated`);
if (!Array.isArray(repositories) || repositories.length === 0) {
  throw new Error('No accessible academic repositories were found.');
}

const languages = {};
for (const repository of repositories) {
  const repositoryLanguages = await getJson(repository.languages_url);
  for (const [language, bytes] of Object.entries(repositoryLanguages)) {
    languages[language] = (languages[language] || 0) + bytes;
  }
}

const totals = {
  repositories: repositories.length,
  privateRepositories: repositories.filter((repository) => repository.private).length,
  stars: repositories.reduce((sum, repository) => sum + repository.stargazers_count, 0),
  forks: repositories.reduce((sum, repository) => sum + repository.forks_count, 0),
};

const stats = [
  ['Repositories', totals.repositories],
  ['Private', totals.privateRepositories],
  ['Stars', totals.stars],
  ['Forks', totals.forks],
];

const statsContent = stats.map(([label, value], index) => {
  const column = index % 2;
  const row = Math.floor(index / 2);
  const x = column === 0 ? 24 : 204;
  const y = 88 + row * 54;
  return `<text x="${x}" y="${y}" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="24" font-weight="600">${value}</text>
  <text x="${x}" y="${y + 20}" fill="#8b949e" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="13">${label}</text>`;
}).join('
  ');

const languageEntries = Object.entries(languages)
  .sort(([, left], [, right]) => right - left)
  .slice(0, 6);
const totalLanguageBytes = languageEntries.reduce((sum, [, bytes]) => sum + bytes, 0) || 1;

const languageContent = languageEntries.map(([language, bytes], index) => {
  const y = 72 + index * 28;
  const percentage = (bytes / totalLanguageBytes) * 100;
  const width = Math.max(3, Math.round((percentage / 100) * 160));
  return `<text x="24" y="${y}" fill="#c9d1d9" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="13">${escapeXml(language)}</text>
  <rect x="152" y="${y - 11}" width="160" height="8" rx="4" fill="#21262d"/>
  <rect x="152" y="${y - 11}" width="${width}" height="8" rx="4" fill="#f4d03f"/>
  <text x="328" y="${y}" fill="#8b949e" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="12">${percentage.toFixed(1)}%</text>`;
}).join('
  ') || '<text x="24" y="82" fill="#8b949e" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="13">No language data available</text>';

await mkdir('profile', { recursive: true });
await writeFile('profile/academic-stats.svg', cardShell('Academic Workspace', statsContent, 190));
await writeFile('profile/academic-top-langs.svg', cardShell('Academic Workspace Languages', languageContent, 250));
