package app.omnivore.omnivore.dataService

import android.util.Log
import androidx.room.PrimaryKey
import app.omnivore.omnivore.models.ServerSyncStatus
import app.omnivore.omnivore.networking.*
import app.omnivore.omnivore.persistence.entities.*

suspend fun DataService.librarySearch(cursor: String?, query: String): SearchResult {
  val searchResult = networker.search(cursor = cursor, limit = 10, query = query)

  val savedItems = searchResult.items.map {
    SavedItemWithLabelsAndHighlights(
      savedItem = it.item,
      labels = it.labels,
      highlights = it.highlights,
    )
  }

  db.savedItemWithLabelsAndHighlightsDao().insertAll(savedItems)

  Log.d("sync", "found ${searchResult.items.size} items with search api. Query: $query cursor: $cursor")

  return SearchResult(
    hasError = false,
    hasMoreItems = false,
    cursor = searchResult.cursor,
    count = searchResult.items.size,
    savedItems = savedItems
  )
}

suspend fun DataService.sync(since: String, cursor: String?, limit: Int = 20): SavedItemSyncResult {
  val syncResult = networker.savedItemUpdates(cursor = cursor, limit = limit, since = since)
    ?: return SavedItemSyncResult.errorResult

  if (syncResult.deletedItemIDs.isNotEmpty()) {
    db.savedItemDao().deleteByIds(syncResult.deletedItemIDs)
  }

  val savedItems = syncResult.items.map {
    val savedItem = SavedItem(
      savedItemId = it.id,
      title = it.title,
      createdAt = it.createdAt as String,
      savedAt = it.savedAt as String,
      readAt = it.readAt as String?,
      updatedAt = it.updatedAt as String?,
      readingProgress = it.readingProgressPercent,
      readingProgressAnchor = it.readingProgressAnchorIndex,
      imageURLString = it.image,
      pageURLString = it.url,
      descriptionText = it.description,
      publisherURLString = it.originalArticleUrl,
      siteName = it.siteName,
      author = it.author,
      publishDate = it.publishedAt as String?,
      slug = it.slug,
      isArchived = it.isArchived,
      contentReader = it.contentReader.rawValue,
      content = null,
      wordsCount = it.wordsCount
    )
    val labels = it.labels?.map { label ->
      SavedItemLabel(
        savedItemLabelId = label.labelFields.id,
        name = label.labelFields.name,
        color = label.labelFields.color,
        createdAt = null,
        labelDescription = null
      )
    } ?: listOf()
    val highlights = it.highlights?.map { highlight ->
      Highlight(
        type = highlight.highlightFields.type.toString(),
        highlightId = highlight.highlightFields.id,
        annotation = highlight.highlightFields.annotation,
        createdByMe = highlight.highlightFields.createdByMe,
        markedForDeletion = false,
        patch = highlight.highlightFields.patch,
        prefix = highlight.highlightFields.prefix,
        quote = highlight.highlightFields.quote,
        serverSyncStatus = ServerSyncStatus.IS_SYNCED.rawValue,
        shortId  = highlight.highlightFields.shortId,
        suffix  = highlight.highlightFields.suffix,
        createdAt = null,
        updatedAt  = highlight.highlightFields.updatedAt as String?,
      )
    } ?: listOf()
    SavedItemWithLabelsAndHighlights(
      savedItem = savedItem,
      labels = labels,
      highlights = highlights
    )
  }

  db.savedItemWithLabelsAndHighlightsDao().insertAll(savedItems)

  Log.d("sync", "found ${syncResult.items.size} items with sync api. Since: $since")

  return SavedItemSyncResult(
    hasError = false,
    hasMoreItems = syncResult.hasMoreItems,
    cursor = syncResult.cursor,
    count = syncResult.items.size,
    savedItemSlugs = syncResult.items.map { it.slug }
  )
}

fun DataService.isSavedItemContentStoredInDB(slug: String): Boolean {
  val existingItem = db.savedItemDao().getSavedItemWithLabelsAndHighlights(slug)
  val content = existingItem?.savedItem?.content ?: ""
  return content.length > 10
}

suspend fun DataService.fetchSavedItemContent(slug: String) {
  val syncResult = networker.savedItem(slug)

  val savedItem = syncResult.item
  savedItem?.let {
    val item = SavedItemWithLabelsAndHighlights(
      savedItem = savedItem,
      labels = syncResult.labels,
      highlights = syncResult.highlights
    )
    db.savedItemWithLabelsAndHighlightsDao().insertAll(listOf(item))
  }
}


data class SavedItemSyncResult(
  val hasError: Boolean,
  val hasMoreItems: Boolean,
  val count: Int,
  val savedItemSlugs: List<String>,
  val cursor: String?
) {
  companion object {
    val errorResult = SavedItemSyncResult(hasError = true, hasMoreItems = true, cursor = null, count = 0, savedItemSlugs = listOf())
  }
}

data class SearchResult(
  val hasError: Boolean,
  val hasMoreItems: Boolean,
  val count: Int,
  val savedItems: List<SavedItemWithLabelsAndHighlights>,
  val cursor: String?
) {
  companion object {
    val errorResult = SearchResult(hasError = true, hasMoreItems = true, cursor = null, count = 0, savedItems = listOf())
  }
}
