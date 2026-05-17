package com.masplatform.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Forwards all non-API, non-asset requests to index.html so that
 * React Router can handle client-side navigation.
 */
@Controller
public class SpaController {

    @GetMapping(value = {
            "/",
            "/login",
            "/register",
            "/dashboard",
            "/agents",
            "/agents/**",
            "/workflows",
            "/workflows/**",
            "/sessions",
            "/sessions/**",
            "/templates",
            "/templates/**",
            "/runs",
            "/runs/**",
    })
    public String spa() {
        return "forward:/index.html";
    }
}
