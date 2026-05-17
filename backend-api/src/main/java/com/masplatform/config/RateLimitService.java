package com.masplatform.config;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Per-user token-bucket rate limiting backed by Bucket4j in-memory buckets.
 * Two bucket families:
 *   chat    — expensive engine calls, tighter limit
 *   general — ordinary CRUD, looser limit
 *
 * Limits are configured via app.rate-limit.* in application.yml.
 */
@Service
@RequiredArgsConstructor
public class RateLimitService {

    private final AppProperties props;

    private final ConcurrentHashMap<String, Bucket> chatBuckets    = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Bucket> generalBuckets = new ConcurrentHashMap<>();

    public boolean tryConsumeChat(String userId) {
        return chatBuckets.computeIfAbsent(userId, k -> buildBucket(
                props.getRateLimit().getChatPerMinute())).tryConsume(1);
    }

    public boolean tryConsumeGeneral(String userId) {
        return generalBuckets.computeIfAbsent(userId, k -> buildBucket(
                props.getRateLimit().getGeneralPerMinute())).tryConsume(1);
    }

    private static Bucket buildBucket(int requestsPerMinute) {
        Bandwidth limit = Bandwidth.builder()
                .capacity(requestsPerMinute)
                .refillGreedy(requestsPerMinute, Duration.ofMinutes(1))
                .build();
        return Bucket.builder().addLimit(limit).build();
    }
}
