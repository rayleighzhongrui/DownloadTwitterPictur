function getCsrfToken() {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'ct0') {
      return decodeURIComponent(value);
    }
  }
  return null;
}

function findVideoUrlInResponse(data, tweetId, parsePath) {
  try {
    let media = null;

    if (parsePath === 'data.tweetResult.result') {
      const result = data?.data?.tweetResult?.result;
      if (!result) {
        return null;
      }
      const legacy = result.legacy || result.tweet?.legacy;
      media = legacy?.extended_entities?.media;
    } else {
      const instructions = data?.data?.threaded_conversation_with_injections_v2?.instructions;
      if (!instructions || !Array.isArray(instructions)) {
        return null;
      }
      const addEntriesInstruction = instructions.find(i => i.type === 'TimelineAddEntries');
      if (!addEntriesInstruction || !Array.isArray(addEntriesInstruction.entries)) {
        return null;
      }
      const targetEntry = addEntriesInstruction.entries.find(e => e.entryId && e.entryId.includes(tweetId));
      if (!targetEntry) {
        return null;
      }
      const tweetResults = targetEntry.content?.itemContent?.tweet_results;
      if (!tweetResults) {
        return null;
      }
      const legacy = tweetResults.result?.tweet?.legacy || tweetResults.result?.legacy;
      media = legacy?.extended_entities?.media;
    }

    if (!media || !Array.isArray(media)) {
      return null;
    }

    for (const mediaItem of media) {
      if (mediaItem.type === 'video' || mediaItem.type === 'animated_gif') {
        const videoInfo = mediaItem.video_info;
        if (videoInfo && videoInfo.variants) {
          const mp4Variants = videoInfo.variants.filter(v => v.content_type === 'video/mp4');
          if (mp4Variants.length > 0) {
            mp4Variants.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
            return mp4Variants[0].url;
          }
        }
      }
    }

    return null;
  } catch (error) {
    console.error('解析视频URL失败:', error);
    return null;
  }
}

async function callTwitterAPI(csrfToken, api, tweetId) {
  const url = new URL(`https://x.com/i/api/graphql/${api.QUERY_ID}/${api.QUERY_NAME}`);
  url.searchParams.append('variables', JSON.stringify(api.variables));
  url.searchParams.append('features', JSON.stringify(api.features));
  if (api.fieldToggles) {
    url.searchParams.append('fieldToggles', JSON.stringify(api.fieldToggles));
  }

  const response = await fetch(url.href, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
      'x-twitter-active-user': 'yes',
      'x-csrf-token': csrfToken,
      'User-Agent': navigator.userAgent
    }
  });

  if (!response.ok) {
    const error = new Error(`API request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  return findVideoUrlInResponse(data, tweetId, api.parsePath);
}

export async function fetchVideoUrlFromTwitterAPI(tweetId) {
  try {
    const csrfToken = getCsrfToken();
    if (!csrfToken) {
      throw new Error('无法获取CSRF token');
    }

    const apis = [
      {
        QUERY_ID: '0hWvDhmW8YQ-S_ib3azIrw',
        QUERY_NAME: 'TweetResultByRestId',
        variables: {
          tweetId,
          withCommunity: false,
          includePromotedContent: false,
          withVoice: false
        },
        features: {
          creator_subscriptions_tweet_preview_api_enabled: false,
          tweetypie_unmention_optimization_enabled: true,
          responsive_web_edit_tweet_api_enabled: true,
          graphql_is_translatable_rweb_tweet_is_translatable_enabled: false,
          view_counts_everywhere_api_enabled: false,
          longform_notetweets_consumption_enabled: true,
          responsive_web_twitter_article_tweet_consumption_enabled: false,
          tweet_awards_web_tipping_enabled: false,
          freedom_of_speech_not_reach_fetch_enabled: true,
          standardized_nudges_misinfo: false,
          tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
          longform_notetweets_rich_text_read_enabled: false,
          longform_notetweets_inline_media_enabled: false,
          responsive_web_graphql_exclude_directive_enabled: true,
          verified_phone_label_enabled: false,
          responsive_web_media_download_video_enabled: false,
          responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
          responsive_web_graphql_timeline_navigation_enabled: false,
          responsive_web_enhance_cards_enabled: false
        },
        fieldToggles: {
          withArticleRichContentState: false,
          withAuxiliaryUserLabels: false
        },
        parsePath: 'data.tweetResult.result'
      },
      {
        QUERY_ID: '_8aYOgEDz35BrBcBal1-_w',
        QUERY_NAME: 'TweetDetail',
        variables: {
          focalTweetId: tweetId,
          rankingMode: 'Relevance',
          includePromotedContent: false,
          withCommunity: false,
          withQuickPromoteEligibilityTweetFields: false,
          withBirdwatchNotes: false,
          withVoice: false
        },
        features: {
          rweb_video_screen_enabled: false,
          profile_label_improvements_pcf_label_in_post_enabled: true,
          rweb_tipjar_consumption_enabled: true,
          verified_phone_label_enabled: false,
          creator_subscriptions_tweet_preview_api_enabled: true,
          responsive_web_graphql_timeline_navigation_enabled: true,
          responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
          premium_content_api_read_enabled: false,
          communities_web_enable_tweet_community_results_fetch: true,
          c9s_tweet_anatomy_moderator_badge_enabled: true,
          responsive_web_grok_analyze_button_fetch_trends_enabled: false,
          responsive_web_grok_analyze_post_followups_enabled: true,
          responsive_web_jetfuel_frame: false,
          responsive_web_grok_share_attachment_enabled: true,
          articles_preview_enabled: true,
          responsive_web_edit_tweet_api_enabled: true,
          graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
          view_counts_everywhere_api_enabled: true,
          longform_notetweets_consumption_enabled: true,
          responsive_web_twitter_article_tweet_consumption_enabled: true,
          tweet_awards_web_tipping_enabled: false,
          responsive_web_grok_show_grok_translated_post: false,
          responsive_web_grok_analysis_button_from_backend: false,
          creator_subscriptions_quote_tweet_preview_enabled: false,
          freedom_of_speech_not_reach_fetch_enabled: true,
          standardized_nudges_misinfo: true,
          tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
          longform_notetweets_rich_text_read_enabled: true,
          longform_notetweets_inline_media_enabled: true,
          responsive_web_grok_image_annotation_enabled: true,
          responsive_web_enhance_cards_enabled: false
        },
        fieldToggles: {
          withArticleRichContentState: true,
          withArticlePlainText: false,
          withGrokAnalyze: false,
          withDisallowedReplyControls: false
        },
        parsePath: 'threaded_conversation_with_injections_v2'
      }
    ];

    for (const api of apis) {
      try {
        const videoUrl = await callTwitterAPI(csrfToken, api, tweetId);
        if (videoUrl) {
          return videoUrl;
        }
      } catch (error) {
        console.log(`${api.QUERY_NAME} 失败:`, error.message);
      }
    }

    return null;
  } catch (error) {
    console.error('调用Twitter API失败:', error);
    return null;
  }
}
