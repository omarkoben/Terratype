﻿using System;
using System.Collections.Generic;

namespace Terratype.Indexer.Searchers
{
	public class AncestorSearchRequest : ISearchRequest
	{
		public Guid Ancestor { get; set; }
	}

	public interface IAncestorSearch<AncestorSearchRequest> : ISearch<ISearchRequest>
	{
		IEnumerable<IMap> Execute(AncestorSearchRequest request);
	}
}
