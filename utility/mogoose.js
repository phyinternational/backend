const buildPaginatedSortedFilteredQuery = async (query, req, model) => {
  const page = req.query.page * 1 || 1;
  const limit = req.query.limit * 1 || 10;
  const sort = req.query.sort || "-createdAt";
  const skip = (page - 1) * limit;

  query = query.skip(skip).limit(limit).sort(sort);
  const clonedQuery = query.clone();
  clonedQuery.skip(undefined).limit(undefined);

  const promises = [query, clonedQuery];

  const [result, total] = await Promise.all(promises);

  result.page = page;
  result.limit = limit;
  result.total = total.length;

  return result;
};

exports.buildPaginatedSortedFilteredQuery = buildPaginatedSortedFilteredQuery;

