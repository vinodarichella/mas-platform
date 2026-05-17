package com.masplatform.config;

import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Exposes a named CircuitBreaker bean for the Python execution engine.
 * The circuit opens after 50% failures over the last 10 calls, waits 60s
 * before allowing test calls through again.
 *
 * Configuration is in application.yml under resilience4j.circuitbreaker.instances.engine.
 */
@Configuration
public class EngineCircuitBreakerConfig {

    @Bean
    public CircuitBreaker engineCircuitBreaker(CircuitBreakerRegistry registry) {
        return registry.circuitBreaker("engine");
    }
}
