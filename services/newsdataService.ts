export const fetchRawArticles = async () => {
  const apiKey = process.env.NEWSDATA_API_KEY;

  if (!apiKey) {
    const errorMessage = "Newsdata.io API key is missing. Please set the NEWSDATA_API_KEY environment variable.";
    console.error(errorMessage);
    throw new Error(errorMessage);
  }

  const baseParams =
    `?apikey=${apiKey}` +
    `&country=BD` +
    `&language=en` +
    `&q=Bangladesh` +
    `&prioritydomain=top` +
    `&image=1` +
    `&size=10`;
  const baseUrl = `https://newsdata.io/api/1/latest${baseParams}`;

  const allArticles: any[] = [];
  let nextPageToken: string | undefined;

  try {
    // up to 3 pages of 10 articles each
    for (let i = 0; i < 3; i++) {
      const url = nextPageToken
        ? `${baseUrl}&page=${nextPageToken}`
        : baseUrl;
      const resp = await fetch(url);

      if (!resp.ok) {
        throw new Error(
          `Newsdata.io request failed (status ${resp.status})`
        );
      }

      const data = await resp.json();
      if (data.results?.length) {
        allArticles.push(...data.results);
      }

      nextPageToken = data.nextPage;
      if (!nextPageToken) break; // no more pages
    }

    // filter & dedupe
    const valid = allArticles.filter(
      (a: any) =>
        a.article_id &&
        a.image_url &&
        a.title &&
        a.description
    );
    const unique = Array.from(
      new Map(valid.map(a => [a.article_id, a])).values()
    );

    return unique.slice(0, 30);
  } catch (error) {
    console.error("Error fetching articles:", error);
    throw error;
  }
};